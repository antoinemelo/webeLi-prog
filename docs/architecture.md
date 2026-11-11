# Architecture

## Vue d'ensemble

InformaticLi est une application statique « browser first ». Les editeurs,
interpreteurs et bases SQLite s'executent principalement dans le navigateur.
Le serveur Python principal ne fait que distribuer les fichiers.

```text
Navigateur
  |
  +-- index.html + assets/css/app.css
  |
  +-- labs/
  |     +-- html/        apercu dans une iframe sandboxee
  |     +-- javascript/  apercu et console dans une iframe sandboxee
  |     +-- markdown/    marked + highlight.js
  |     +-- python/      Brython
  |     +-- sql/         SQLite via sql.js/WebAssembly + Mermaid
  |     +-- dactylo/     exercices texte + progression SQLite locale
  |
  +-- assets/aide/       lexique lu depuis aide.db
  +-- assets/liens/      redirections pedagogiques lues depuis link.db
  |
  +-- API distantes facultatives
        +-- statistiques anonymisees
        +-- mode examen
        +-- demonstration blockchain
```

## Donnees locales

Les ateliers utilisent `localStorage` pour conserver le code, la position du
curseur, les preferences et certaines bases SQLite serialisees. Le partage par
lien place le code dans le parametre `c`, encode en Base64 URL-safe. Base64
n'est ni un chiffrement ni un mecanisme de confidentialite.

Les fichiers de progression et les bases exportees restent sous le controle de
l'utilisateur. Le dossier `partage/` appartient au serveur local de fichiers et
n'est pas versionne.

### Fichiers de l'atelier Python

Le menu **Projet**, à droite d’**Effacer**, crée ou importe des fichiers texte UTF-8, télécharge le
fichier actif ou exporte un ZIP contenant tous les scripts ouverts et tous les fichiers.
Les onglets permettent de modifier les données avant ou pendant l'exécution.
La barre des onglets et son bouton **+** restent masqués tant qu'aucun fichier
n'est ouvert. **Projet → Nouveau fichier texte** permet de créer le premier
fichier et fait apparaître la barre. Fermer le dernier onglet la masque à nouveau.
Le bouton **+** à côté des onglets crée ensuite un fichier ; la croix **×** ferme
l'onglet en conservant son contenu dans le projet. Les fichiers fermés restent
accessibles au code Python et dans le ZIP exporté. Le menu **Projet → Fichiers
fermés** permet de les rouvrir. Une écriture Python dans un fichier fermé
actualise son contenu sans rouvrir l'onglet. L'état fermé est conservé après
rechargement sous `py_workspace_closed_files_v1` ; **Supprimer le fichier actif**
reste la commande de suppression définitive.
Chaque lecture Python consulte le contenu actuel ; une modification conserve
le curseur du fichier ouvert. Les écritures du programme restent visibles et
sont mémorisées même lorsqu'on interrompt ensuite son exécution.
**Effacer** vide uniquement les résultats et le dessin Turtle ; supprimer un
fichier passe par une commande distincte avec confirmation. Les données sont
mémorisées dans `localStorage` sous `py_workspace_files_v1`, pour cette origine
et ce navigateur. Le lien de partage et les commandes historiques du menu
**Fichier** portent sur le script seul ; utiliser le ZIP du menu **Projet**
pour emporter les données aussi. Pour rouvrir un projet, extraire le ZIP,
ouvrir son `.py` dans l'éditeur et importer les fichiers texte à droite.

`virtual_files.py` gère les modes `r`, `w`, `a`, `x` et leurs variantes `+`,
les curseurs, les lectures (`read`, `readline`, `readlines`, itération),
l'écriture (`write`, `writelines`, `print(file=...)`) et la fermeture.
`execution.py` adapte temporairement `open()` et les entrées/sorties, y compris
après une erreur ou `sys.exit()`. Le code utilisateur tourne dans le Web Worker
`worker.js`, avec `worker_runtime.py`. Le moteur est préchargé dès l'ouverture
de l'atelier, puis réutilisé entre les exécutions pour éviter de recharger et
de compiler Brython à chaque clic. Chaque programme dispose de nouvelles
variables globales, de nouveaux fichiers ouverts et de nouvelles références
Turtle ; les modules Python déjà importés restent en mémoire.
`assets/js/python-execution.js` pilote le Worker, les sorties et l'arrêt.
Après 3,5 secondes, **Arrêter** apparaît en
rouge : un clic ou **Échap** interrompt le programme, sans arrêt automatique.
Échap fonctionne dès le lancement, même avant l'apparition du bouton. Terminer
le Worker arrête aussi une boucle qui ne produit aucune sortie, sans bloquer
la page. Après un arrêt manuel, un nouveau moteur est préparé en arrière-plan ;
une exécution lancée immédiatement peut attendre sa préparation. Une erreur
Python ordinaire conserve le moteur disponible. La console conserve au maximum
les 100 000 derniers caractères.

**Ctrl+S** (ou **⌘+S**) enregistre le script courant ; **F12** ouvre
**Enregistrer sous**. Ces raccourcis utilisent les mêmes commandes que le menu
Fichier. Sans prise en charge de l'enregistrement direct par le navigateur,
ils téléchargent le script. Hors exécution, Échap conserve son rôle habituel,
notamment la fermeture de la vue Turtle agrandie.

Les échanges synchrones du Worker avec les fichiers, `input()` et Turtle
utilisent un `SharedArrayBuffer` lorsque l'isolation du navigateur est disponible
(HTTPS avec les en-têtes adaptés, ou `localhost`). Sur le réseau de l'école en
HTTP, `python_bridge.py` relaie les réponses en mémoire sur le serveur central.
Le Worker envoie sa demande directement à la page avec `postMessage`, puis attend
une réponse avec une requête HTTP synchrone ; la page traite la demande et publie
la réponse au relais par `fetch`. Seul le Worker attend : l'interface reste
utilisable et **Arrêter** / **Échap** peuvent terminer une boucle infinie.
Les deux transports limitent chaque réponse à 8 Mo et utilisent les mêmes
opérations de lecture, écriture, saisie et dessin.

Une session de relais aléatoire est ouverte par exécution et fermée à sa fin,
à l'arrêt ou à la fermeture de la page. Les réponses sont consommées une seule
fois et ordonnées par numéro de demande. Une attente HTTP expire après 25 secondes
et est renouvelée par le Worker, notamment quand l'élève réfléchit à un `input()`.
Un signal toutes les 30 secondes conserve la session lors des calculs sans
entrée/sortie ; les sessions abandonnées sont nettoyées au prochain échange après
120 secondes d'inactivité. Le serveur limite le relais à 128 sessions et 64 Mo
de réponses en attente. Les programmes restent exécutés dans les navigateurs ;
le relais n'ouvre aucun fichier du serveur et n'enregistre aucun projet sur disque.

`runner.py` ne lance plus le code utilisateur : il ne réalise que les appels
Turtle demandés par le Worker, pour conserver le rendu SVG existant. Les
coordonnées et les objets Turtle courants sont renvoyés au programme.
`assets/js/python-files.js` relie ces fichiers aux onglets, aux imports/exports
et au stockage. Les exemples et fichiers du support conservés dans
`activities.json` servent aux tests de compatibilité ; ils ne sont pas chargés
ni affichés dans l’interface.

Ce système pédagogique manipule des noms de fichiers sans dossiers, en texte
UTF-8 uniquement, sans accès au disque ni écriture serveur. Les positions de
`seek()` / `tell()` comptent les caractères et acceptent les déplacements
relatifs du support ; ce comportement diffère des positions opaques des
fichiers texte CPython. Avec le contenu `1ere ligne\n2e ligne\nfin\n`, la
longueur est 24 caractères et le mot `ligne` commence à la position 5 : les
exemples intégrés corrigent les décalages du support. Les comportements sont
couverts par `tests/test_python_files.py` et les validations du projet.

### Scripts Python ouverts

`assets/js/python-scripts.js` conserve entre un et trois scripts dans le même
éditeur. Les noms restent dans des étiquettes arrondies, à l'emplacement du nom
de fichier en haut : vert pour le script actif, bleu pour les autres. Le bouton
**+** ajoute un script et disparaît lorsque trois scripts sont ouverts. Avec
plusieurs scripts, la croix ferme celui qui est désigné ; une confirmation protège
ses modifications non enregistrées. Le dernier script reste ouvert.

Chaque script conserve son code, son nom de fichier, sa sélection, son défilement,
son historique d'annulation et son état de sauvegarde. **Fichier**, **Partager**,
**Réinitialiser**, **Exécuter**, Ctrl+S, F12 et F9 concernent le script actif.
Ouvrir ou déposer un fichier remplace uniquement ce script, avec confirmation
s'il contient des modifications non enregistrées. L'annulation ou l'échec d'une
sauvegarde conserve la destination précédente. Une sauvegarde prend une copie
du contenu au lancement ; des modifications apportées pendant l'écriture restent
signalées comme non enregistrées.

Le stockage `py_editor_scripts_v1` conserve les scripts, leurs noms, leurs positions,
leur état de sauvegarde et le script actif après rechargement. L'ancien script
unique est repris automatiquement. Les poignées d'accès au disque et l'historique
d'annulation restent en mémoire : après rechargement, le navigateur demande à
nouveau la destination d'enregistrement. En HTTP sans accès direct au disque,
Enregistrer et Enregistrer sous téléchargent le script et actualisent son nom.
Si le presse-papiers n'est pas accessible en HTTP, Partager affiche le lien ou
le code iframe du script actif dans un champ permettant de le copier.

Une seule exécution est autorisée. Pendant celle-ci, le choix d'un autre script,
la création, la fermeture, l'ouverture et la réinitialisation sont verrouillés.
La fin, une erreur ou **Arrêter / Échap** les libère. Le verrou s'applique aussi
pendant les opérations de fichier asynchrones pour préserver leur destination.
La saisie dans le script courant reste possible.

Le panneau de droite reste commun : changer de script conserve les résultats,
le dessin Turtle et les fichiers de données. Un script peut créer un fichier
qu'un autre lit ensuite. Exécuter conserve le comportement précédent de remise
à zéro de la console et des références Turtle. Le ZIP Projet contient tous les scripts ouverts et les fichiers de données communs.

### Affichage Turtle

`assets/js/python-turtle.js` adapte le SVG produit par Brython à son panneau.
La vue initiale englobe les positions finales du dessin, même au-delà du
canevas natif de 500 × 500, sans modifier les coordonnées ni l'animation.
Les boutons **+**, **−** et **Tout voir** règlent le zoom ; glisser déplace la
vue. **Agrandir** ouvre une vue occupant la fenêtre, refermable avec **Réduire**
ou **Échap**. Le panneau reste utilisable sur mobile et le panneau Résultat
peut défiler lorsque des fichiers sont également ouverts. Cette adaptation
porte sur l'affichage ; les fonctions Turtle non implémentées par la version
de Brython embarquée, telles que `screensize()` et `setup()`, restent inchangées.

## Bibliotheques embarquees

Les bibliotheques lourdes sont conservees dans `assets/js/dist` et
`assets/css/dist` afin que les ateliers principaux puissent fonctionner sans
CDN : Bootstrap, Brython, Chart.js, highlight.js, html2pdf, JSZip, marked,
Mermaid et sql.js.

Certaines demonstrations secondaires utilisent encore des services distants ;
elles doivent donc etre considerees comme facultatives en mode hors-ligne.

## Frontieres de confiance

- Le code saisi dans les ateliers HTML et JavaScript est non fiable et doit
  rester dans une iframe sans origine partagee avec l'application.
- Le Markdown partage peut contenir du HTML ; il est filtre avant insertion.
- Les bases SQLite importees sont traitees comme des donnees non fiables.
- Les serveurs de fichiers sont des outils de reseau local, pas des services a
  exposer directement sur Internet.
- Les services `parapente.world` et `simce.swiss` sont hors de ce depot.

## Choix de conception

Le projet reste volontairement sans etape de compilation frontend. Ce choix
facilite l'utilisation en classe et la copie hors-ligne, mais impose des tests
statiques et une discipline stricte sur les chemins, les versions et les
scripts globaux.

### Documents HTML/CSS, Markdown et SQL

`assets/js/workshop-documents.js` permet d'ouvrir jusqu'à trois documents dans
chacun de ces ateliers. Les noms arrondis restent au centre de l'en-tête : vert
pour le document actif, bleu pour les autres. Le **+** disparaît à trois documents.
Chaque document conserve son nom, son contenu, sa sélection, son défilement et
son historique d'annulation. Les commandes Fichier, Partager et Réinitialiser
portent uniquement sur le document actif. Les sélecteurs de fichiers et les
écritures en cours verrouillent temporairement le changement de document.
L'aperçu Markdown suit le document sélectionné ; chaque document HTML conserve
son dernier aperçu et ses images chargées pendant la session. Les CSS restent
communs et visibles à droite lors des changements de document, comme les fichiers
texte de Python. SQL conserve également une seule base et les résultats à droite,
indépendamment du script sélectionné.

Les clés `html_editor_documents_v1`, `md_editor_documents_v1` et
`sql_editor_documents_v1` conservent les
documents après actualisation et reprennent les anciennes sauvegardes à un seul
document. Les poignées de fichiers locaux et l'historique d'annulation restent
en mémoire. Après actualisation, Enregistrer redemande une destination lorsque
l'API native est disponible. En HTTP réseau, cette commande télécharge le fichier
Markdown ou le HTML avec ses CSS dans un ZIP. Une édition faite pendant une
écriture reste signalée comme non enregistrée.

`assets/js/html-css-files.js` gère **Projet → Nouveau fichier CSS / Importer des
fichiers CSS**, le téléchargement du CSS actif, le ZIP et la suppression avec
confirmation. La barre CSS et son **+** restent masqués tant qu'aucun CSS n'est
ouvert ; lancer l'aperçu ne crée pas d'onglets. Une création ou un import ajoute
la balise `<link>` si nécessaire. **×** ferme seulement l'onglet : le contenu reste
appliqué à l'aperçu, conservé après actualisation et inclus dans l'export. Le menu
**Fichiers fermés** permet de le rouvrir. Retirer ou commenter une balise `<link>`
ne supprime plus le fichier CSS. **Effacer** vide seulement l'aperçu.

Les CSS sont conservés sous `html_workspace_css_v1`, avec leur onglet actif,
leur état ouvert/fermé et leur contenu. La migration de l'ancienne version fusionne
les fichiers associés aux documents : deux contenus différents sous le même nom
sont conservés sous des noms distincts, et les liens du HTML concerné sont ajustés.
La création, la fermeture ou la réinitialisation d'un document ne supprime pas
les CSS communs. Les images restent associées à chaque document pendant la session.
**Fichier → Ouvrir** relit aussi un ZIP HTML/CSS ; les CSS importés rejoignent
l'espace commun, avec confirmation avant remplacement d'un contenu différent.
Le partage incorpore les CSS liés à la page dans le HTML partagé.

### ZIP des projets et base commune SQL

`assets/js/workshop-project.js` prépare une copie des contenus au clic sur
**Projet → Télécharger le projet ZIP** :

- HTML : tous les documents HTML ouverts et tous les CSS, même fermés ;
- Markdown : tous les documents Markdown ouverts ;
- Python : tous les scripts ouverts et tous les fichiers de données, même fermés ;
- SQL : tous les scripts ouverts et la base SQLite courante complète.

Les fichiers de données conservent leur nom ; les scripts homonymes reçoivent un
suffixe dans le ZIP pour ne pas s'écraser. Les scripts sans nom reçoivent un nom
avec leur extension. Les modifications non enregistrées sont incluses. Une édition
pendant la compression ne modifie pas la copie en cours d'export. Les images HTML
importées restent à transférer séparément.

Dans SQL, **Réinitialiser** réinitialise seulement le script actif. **SQLite →
Vider la base de données** vide explicitement la base commune après confirmation.
Le stockage `sql_editor_db_bin_v3` de la base reste inchangé ; l'ancien script
`sql_editor_code_v3` est repris lors de la migration. Les ouvertures de fichiers,
chargements de bases, sauvegardes et exécutions verrouillent le changement de
script jusqu'à leur fin. Une erreur SQL conserve les instructions déjà exécutées
et leur résultat dans la base commune mémorisée.
