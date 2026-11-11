# webeLi-prog / InformaticLi

Plateforme pedagogique web pour apprendre et pratiquer HTML/CSS, JavaScript,
Markdown, Python et SQL directement dans le navigateur. Le projet comprend
egalement un atelier de dactylographie, un lexique SQLite et des outils locaux
de partage de fichiers pour une salle de classe.

## Demarrage rapide

Prérequis : Python 3.11 ou plus récent. Le site principal n'a pas besoin de
Node.js, PHP ni d'une base de donnees serveur.

```bash
python3 ServeurHTTP_Web.py
```

Ouvrir ensuite l'URL affichee dans le terminal. Par defaut, le serveur ecoute
uniquement sur la machine locale, sur `http://127.0.0.1:8000/`.

Pour rendre le site visible sur le reseau de la classe :

```bash
python3 ServeurHTTP_Web.py --host 0.0.0.0
```

Sur le serveur central de l'école, le lanceur `ServeurHTTP_Complet.py` écoute
déjà sur le réseau par défaut. Les élèves ouvrent par exemple
`http://192.168.1.1:8000/labs/python/`. Les fichiers Python (`open`, `read`,
`write`), `input()` et Turtle fonctionnent en HTTP grâce au relais
`python_bridge.py`, à conserver à côté du lanceur. Aucun serveur ni certificat
n'est nécessaire sur les postes élèves. Voir le
[déploiement en réseau](docs/deployment.md#réseau-de-lécole-en-http).

## Composants

- `index.html` : accueil et orientation vers les ateliers ;
- `labs/` : editeurs et exercices executes dans le navigateur ;
- `assets/` : styles, scripts, bibliotheques embarquees, aides et supports ;
- `ServeurHTTP_Web.py` : serveur statique recommande ;
- `ServeurHTTP_Fichiers.py` : depot de fichiers authentifie pour un reseau local ;
- `ServeurFTP_Fichiers.py` : solution FTP historique, non chiffree ;
- `blockchain/` : cas pratique pedagogique, avec services distants facultatifs ;
- `exam/` : integration du service distant reserve aux enseignants.

La cartographie detaillee est disponible dans
[`docs/architecture.md`](docs/architecture.md).

## Partage de fichiers en classe

Le serveur HTTP de fichiers genere un mot de passe temporaire lorsqu'aucun
secret n'est fourni :

```bash
python3 ServeurHTTP_Fichiers.py --host 0.0.0.0
```

Les identifiants sont affiches au demarrage. Pour fixer le secret sans le
placer dans le code source :

```bash
FILEWEB_USER=atelier FILEWEB_PASSWORD='un-secret-long' \
  python3 ServeurHTTP_Fichiers.py --host 0.0.0.0
```

Les fichiers recus sont places dans `partage/`. Ce contenu et sa base de
metadonnees ne sont pas versionnes.

## FTP historique

Installer la dependance optionnelle :

```bash
python3 -m venv .venv
. .venv/bin/activate
python3 -m pip install -r requirements.txt
```

Puis lancer `python3 ServeurFTP_Fichiers.py`. FTP transmet les identifiants et
les fichiers en clair : utiliser de preference le serveur HTTP authentifie et
limiter FTP a un reseau local de confiance.

## Validation

```bash
python3 tools/check_project.py
python3 -m unittest discover -s tests -v
```

Le premier outil verifie les liens locaux, la syntaxe Python et, si Node.js est
installe, la syntaxe JavaScript de premier niveau.

## Documentation

- [Architecture](docs/architecture.md)
- [Installation et exploitation](docs/deployment.md)
- [Securite et donnees](docs/security.md)
- [Guide utilisateur](labs/index.html)

## Statut et licence

Le produit est un environnement educatif, pas un bac a sable hostile ni une
plateforme de cryptomonnaie de production. Les archives du cas blockchain
contiennent leurs propres notices.

Aucune licence logicielle formelle n'est encore declaree a la racine du depot.
Avant une redistribution externe, choisir et ajouter explicitement la licence
souhaitee.
