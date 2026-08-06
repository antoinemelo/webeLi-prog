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
