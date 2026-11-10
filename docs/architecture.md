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
fichier actif ou exporte un ZIP contenant le script et tous les fichiers.
Les onglets permettent de modifier les données avant ou pendant l'exécution.
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
utilisent un `SharedArrayBuffer` (réponse limitée à 8 Mo). L'attente se fait
dans le Worker ; le navigateur peut continuer à traiter les clics et la saisie.
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
