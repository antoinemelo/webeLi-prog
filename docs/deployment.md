# Installation et exploitation

## Site principal

Le mode recommande pour un poste individuel est :

```bash
python3 ServeurHTTP_Web.py
```

Options disponibles :

```text
--host ADRESSE       adresse d'ecoute, 127.0.0.1 par defaut
--port PORT          port HTTP, 8000 par defaut
--cache-secondes N   duree du cache navigateur, 60 par defaut
```

Pour une salle de classe, `--host 0.0.0.0` rend le service accessible sur le
reseau. Verifier le pare-feu local et ne pas rediriger le port depuis Internet.

Le site suppose que son dossier est la racine HTTP. Un deploiement sous un
sous-chemin doit etre valide avec `python3 tools/check_project.py` et un test
navigateur des ateliers.

### Exécution Python interruptible

Les serveurs fournis ajoutent `Cross-Origin-Opener-Policy: same-origin` et
`Cross-Origin-Embedder-Policy: require-corp` pour `/labs/python/` et
`/assets/aide/` (le lexique intégré). Ces en-têtes permettent le partage de
mémoire entre le Worker Python et l'interface **seulement en contexte sécurisé** :
HTTPS, ou l'exception accordée à `localhost` / `127.0.0.1`. Une adresse privée
comme `http://192.168.1.1:8000` n'a pas cette exception. Les autres ateliers
gardent leur politique.

#### Réseau de l'école en HTTP

Lancer sur le serveur central, dans le dossier du site :

```bash
python ServeurHTTP_Complet.py
```

Ce lanceur écoute sur `0.0.0.0:8000` par défaut. Les élèves utilisent par exemple
`http://192.168.1.1:8000/`. Le fichier **`python_bridge.py` doit accompagner le
lanceur**. `ServeurHTTP_Web.py --host 0.0.0.0` prend également en charge le relais.
Il ne faut lancer aucun serveur sur les postes élèves et aucun certificat
n'est requis pour ce mode HTTP.

Quand la mémoire partagée n'est pas disponible, l'atelier utilise automatiquement
le relais HTTP : `open()`, `read()`, `write()`, les modifications des fichiers
pendant l'exécution, `input()` et Turtle restent disponibles. **Arrêter** et
**Échap** continuent d'interrompre le Worker. Les fichiers du projet restent
propres au navigateur de l'élève ; ce dispositif ne donne pas accès aux fichiers
du disque du serveur. Les réponses transitent temporairement par sa mémoire,
sans écriture sur disque. Les allers-retours réseau peuvent ralentir les
programmes faisant beaucoup de lectures ou d'appels Turtle.

Pour mettre à jour une installation existante, copier ensemble :

- `ServeurHTTP_Complet.py` et `python_bridge.py` à la racine du site ;
- `labs/python/index.html` et `labs/python/worker.js` ;
- `assets/js/python-execution.js` et `assets/js/dico.js` ;
- `assets/js/python-files.js` et `assets/css/app.css` pour les boutons **+** et
  **×** des onglets, avec réouverture des fichiers fermés dans le menu Projet ;
- `assets/js/python-scripts.js`, `assets/js/python.js` et `assets/js/app.js`
  pour les trois scripts et leurs commandes de sauvegarde séparées ;
- `ServeurHTTP_Web.py` si ce lanceur est aussi utilisé.

Redémarrer ensuite le serveur central et actualiser les pages des élèves
(`Ctrl+F5` si une ancienne version reste en cache). Le mode optionnel `--php`
utilise un autre serveur et **ne fournit pas ce relais** ; pour cet atelier en
HTTP, utiliser le lancement ci-dessus sans `--php`.

#### Hébergement statique en HTTPS

Sur Apache, IIS ou un autre serveur sans le relais Python, fournir les deux
en-têtes ci-dessus et utiliser HTTPS avec un certificat reconnu par les postes.
Pour un atelier intégré dans une iframe, la page parente doit également permettre
l'isolation. Sur un hébergement statique sans isolation ni relais, les calculs
simples restent possibles ; les appels aux fichiers, à `input()` et à Turtle
affichent une erreur de configuration. Aucun code élève n'est exécuté sur le serveur.

### Publication Apache sous `/tec/`

Pour `https://webe.li/tec/`, les fichiers `labs/python/.htaccess` et
`assets/aide/.htaccess` fournissent ces en-têtes avec `mod_headers`. Les inclure
dans les transferts, même si le logiciel de synchronisation masque les fichiers
commençant par un point. Vérifier les réponses HTTP et `crossOriginIsolated`
dans l'atelier après publication.

Synchroniser les fichiers du site par FTPS, en sauvegardant les fichiers
remplacés avant transfert. Les données de `partage/`, les bases SQLite déjà
présentes, les configurations de l'hébergement et les fichiers absents du
paquet de publication sont conservés. Les serveurs Python locaux, les tests et
les métadonnées Git ne sont pas nécessaires sur l'hébergement web.

## Serveur HTTP de fichiers

```bash
python3 ServeurHTTP_Fichiers.py --host 0.0.0.0
```

Options principales :

```text
--root DOSSIER       dossier partage, `partage/` par defaut
--lecture-seule      desactive upload, creation, renommage et suppression
--max-upload-mio N   taille maximale d'une requete, 100 Mio par defaut
--user NOM           utilisateur HTTP Basic
--password SECRET    secret HTTP Basic (variable d'environnement preferee)
```

Variables correspondantes : `FILEWEB_USER` et `FILEWEB_PASSWORD`. Sans mot de
passe, un secret aleatoire est genere a chaque demarrage.

Sauvegarder le contenu de `partage/` avant un atelier important. La suppression
reste limitee aux dossiers vides, mais elle est immediate.

## Serveur FTP

FTP est fourni uniquement pour les environnements historiques. Installer
`requirements.txt`, puis utiliser les variables `FTP_USER` et `FTP_PASSWORD`.
Sans secret, un mot de passe temporaire est genere. FTP n'apporte aucun
chiffrement ; un observateur du reseau peut lire les identifiants et les
fichiers.

## Qualification avant publication

```bash
python3 tools/check_project.py
python3 -m unittest discover -s tests -v
```

Tester ensuite manuellement au minimum : accueil, ouverture de chaque atelier,
execution d'un exemple, sauvegarde/restauration locale, import/export SQL et
affichage du lexique.

Pour la régression navigateur de Python, avec Playwright et Chromium disponibles
et le serveur local démarré :

```bash
node tools/check_python_browser.cjs
```

Pour reproduire le réseau HTTP sans l'exception de sécurité de `localhost`,
avec `ServeurHTTP_Complet.py` lancé sur le port 8000 :

```bash
PYTHON_LAB_HTTP_LAN=1 node tools/check_python_browser.cjs
```

La régression des scripts multiples utilise les mêmes variables et le même serveur :

```bash
PYTHON_LAB_HTTP_LAN=1 node tools/check_python_scripts_browser.cjs
```

Elle vérifie la limite de trois scripts, le verrouillage pendant une exécution,
les sauvegardes séparées (y compris les annulations et erreurs), l'annulation des
modifications par script, le partage du seul code actif, les fichiers communs,
la restauration après rechargement et la présentation sur ordinateur et mobile.

Ce mode utilise `http://atelier.test:8000`, résolu vers le serveur de test par
Chromium uniquement, et vérifie que `isSecureContext` et `crossOriginIsolated`
sont faux. Il exerce aussi deux navigateurs élèves distincts. Aucun changement
du DNS de l'école ou du fichier `hosts` n'est nécessaire.

Le test vérifie notamment une boucle infinie sans arrêt automatique, le bouton
rouge différé, l'édition des fichiers pendant une boucle, la conservation des
écritures après interruption, la console bornée, `input()` et Turtle. Les
tests de `input()` couvrent une réponse vide, les accents, plusieurs saisies,
l'annulation et une nouvelle exécution après annulation. En HTTP, une saisie
attend également 26 secondes pour vérifier le renouvellement de l'attente réseau. Les
variables `PLAYWRIGHT_MODULE`, `CHROMIUM_EXECUTABLE` et `PYTHON_LAB_URL`
permettent de préciser le module, le navigateur et l'adresse de test.

Pour la régression navigateur Markdown, avec les mêmes prérequis :

```bash
node tools/check_markdown_browser.cjs
```

`MARKDOWN_LAB_URL` permet de tester le site publié. Le test vérifie la coloration
des blocs de code, les thèmes clair et sombre, les langages inconnus, la
restauration après rechargement et l'export HTML. Il vérifie aussi le rendu sans
la bibliothèque de coloration et l'absence d'erreur JavaScript.

## Vérification après publication du 11 novembre 2026

La publication sur `https://webe.li/tec/` a été contrôlée après le transfert.
Le site est statique : aucune migration applicative ni activation supplémentaire
n'est nécessaire. Les contrôles de l'atelier Python sont terminés avec succès.
Le [rapport de vérification](publication-2026-11-11.json) conserve les empreintes
des fichiers et les résultats.

- 186 fichiers accessibles en HTTP 200, dont 178 identiques au dossier `dev`.
  Les sept pages HTML différentes contiennent l'habillage WebeLi et la navigation
  du site publié ; le PDF publié correspond exactement à `../Th_Ex_2026.pdf`.
- En-têtes d'isolation actifs pour Python et son lexique, avec vérification
  de `crossOriginIsolated` et du chargement du lexique intégré.
- Validation statique, 38 tests unitaires et régression navigateur Python réussis
  sur le site publié, y compris sauvegarde, interruption, fichiers en direct,
  Turtle, restauration après rechargement et affichage mobile.
- Accueil, HTML, JavaScript, rendu et restauration Markdown, export/import SQL
  et ouverture de la dactylographie vérifiés.

Le test de conservation des fichiers attend désormais l'écriture et la sortie
du programme avant l'arrêt : en ligne, un Worker froid peut encore charger
l'interpréteur lorsque le bouton Arrêter apparaît.

Une anomalie distincte avait été détectée dans la bibliothèque de coloration Markdown :
`assets/js/dist/highlight@11.11.1/common_min.js` est une version CommonJS et produit
`require is not defined` dans le navigateur. Le rendu Markdown fonctionnait,
y compris les blocs de code, mais cette anomalie faisait échouer le contrôle
général « aucune erreur JavaScript ». Aucun fichier distant ni aucune donnée
de production n'a été modifié pendant cette vérification initiale.

### Correctif Markdown publié le 11 novembre 2026

L'anomalie est corrigée en local et sur le site. La page charge désormais le
[fichier navigateur officiel de highlight.js 11.11.1](https://github.com/highlightjs/cdn-release/tree/11.11.1/build)
(`highlight_min.js`) et sa licence BSD-3-Clause est conservée avec la bibliothèque.
Le rendu utilise l'API `renderer.code` de Marked ; l'ancienne option `highlight`
était ignorée par la version 16.2.1 embarquée. Le thème GitHub clair est chargé
lorsque l'interface est claire ; la palette sombre reste utilisée en mode sombre.
Les langages inconnus restent du texte échappé. Le script de l'atelier porte
une nouvelle référence de cache pour charger le correctif après actualisation.

Cinq fichiers ont été publiés par FTPS, après sauvegarde des deux fichiers
remplacés dans `../.publication-backups/markdown-20261111T035900Z/`. Chaque transfert
a été relu et vérifié. Aucun fichier distant n'a été supprimé.

La validation statique, les 38 tests unitaires et la régression navigateur
Markdown passent. Cette dernière a été exécutée en local puis en ligne :
coloration de plusieurs langages, thèmes, restauration, export HTML et rendu
sans la bibliothèque de coloration. Le contrôle général des ateliers passe
également sans erreur JavaScript ni réponse HTTP en échec.
Le [rapport du correctif](markdown-correction-2026-11-11.json) conserve les résultats,
les empreintes des fichiers publiés et la référence de sauvegarde.

## Projets et scripts multiples publiés le 11 novembre 2026

Pour transférer cette évolution avec le dossier `dev`, inclure :

- `labs/html/index.html`, `labs/markdown/index.html`, `labs/python/index.html` et `labs/sql/index.html` ;
- `assets/js/workshop-project.js`, `assets/js/workshop-documents.js` et `assets/js/html-css-files.js` ;
- `assets/js/html.js`, `assets/js/markdown.js`, `assets/js/sql.js`, `assets/js/python-scripts.js` et `assets/js/python-files.js` ;
- `assets/js/app.js`, `assets/js/dico.js` et `assets/css/app.css`.

Les pages portent la référence de cache `20261111-projects`. Actualiser après le
transfert (Ctrl+F5 si nécessaire). Aucun certificat HTTPS n'est requis : l'ouverture
utilise un sélecteur de fichiers classique en HTTP réseau, et les exports utilisent
les téléchargements du navigateur. Les données restent propres au navigateur et
à l'adresse du site ; une sauvegarde locale n'écrit pas sur le serveur de l'école.

Les CSS HTML deviennent communs à tous les documents ouverts. La migration
conserve les anciens contenus, y compris les variantes portant le même nom.
SQL accepte trois scripts, avec une base commune conservée quand on change ou
réinitialise un script. Les ZIP Projet incluent tous les scripts ouverts, ainsi
que les CSS HTML, les fichiers de données Python ou la base SQLite selon l'atelier.
Markdown possède maintenant aussi le menu Projet.

Contrôles navigateur contre le serveur local sur le port 8000 :

```bash
node tools/check_workshop_documents_browser.cjs
node tools/check_projects_browser.cjs
```

Ils acceptent `PLAYWRIGHT_MODULE` et `CHROMIUM_EXECUTABLE`.
`WORKSHOP_BASE_URL=https://webe.li/tec/` permet aussi de lancer
`check_projects_browser.cjs` sur le site publié, dans des profils de test séparés. Chromium utilise
`http://atelier.test:8000` redirigé vers `127.0.0.1` pour reproduire un contexte
HTTP non sécurisé. Les contrôles couvrent trois documents, les sauvegardes séparées,
les annulations et erreurs, l'historique d'annulation, le rechargement, les CSS
communs, la migration des anciennes sessions, les imports/exports ZIP, les images,
les contenus des quatre archives et la réouverture de la base SQLite exportée.
Les sélecteurs natifs sont simulés dans un profil séparé ; les imports et
les téléchargements HTTP utilisent les véritables contrôles du navigateur.

La publication a été effectuée depuis le commit `ccf0f81` sur la branche
`agent/harden-and-document`. Les 18 fichiers ont été transférés par FTPS après
sauvegarde des anciennes versions, puis relus et comparés par empreinte SHA-256.
La vérification HTTPS confirme les 18 fichiers et les en-têtes d'isolation de
Python et de son lexique. Les tests en ligne des projets HTML, Markdown, Python
et SQL, les ZIP complets, les entrées/sorties Python et Turtle, la coloration
Markdown et le contrôle général du site passent. Les bases SQLite existantes
et les données de partage n'ont pas été remplacées.

Le [rapport de publication](projects-publication-2026-11-11.json) conserve les
empreintes, la référence de sauvegarde et les résultats de validation.
