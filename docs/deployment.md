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
