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

Le serveur fourni ajoute `Cross-Origin-Opener-Policy: same-origin` et
`Cross-Origin-Embedder-Policy: require-corp` pour `/labs/python/` et
`/assets/aide/` (le lexique intégré). Ces en-têtes permettent le partage de
mémoire entre le Worker Python et l'interface : édition des fichiers en
direct, `input()` et dessin Turtle. Les autres ateliers gardent leur politique.

Sur un autre serveur, fournir ces mêmes en-têtes et utiliser HTTPS ou
`http://127.0.0.1`. Pour un atelier intégré dans une iframe, la page parente
doit également permettre l'isolation. Sans cette isolation, les calculs
Python restent exécutés dans un Worker interruptible, mais les opérations
qui demandent les fichiers en direct, une saisie ou Turtle signalent que le
serveur adapté est nécessaire. Aucun code élève n'est exécuté sur le serveur.

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

Le test vérifie notamment une boucle infinie sans arrêt automatique, le bouton
rouge différé, l'édition des fichiers pendant une boucle, la conservation des
écritures après interruption, la console bornée, `input()` et Turtle. Les
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
