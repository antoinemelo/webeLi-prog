# Securite et donnees

## Modele de menace

La plateforme est destinee a des exercices encadres. Elle reduit les risques
accidentels, mais ne pretend pas isoler un attaquant determine. Ne pas saisir de
secret, donnee medicale, mot de passe reel ou cle de production dans un atelier
ou dans une URL partagee.

## Code execute dans le navigateur

- HTML et JavaScript sont executes dans des iframes sandboxees.
- Le rendu Markdown filtre scripts, formulaires, gestionnaires d'evenements et
  URL dangereuses avant insertion dans la page.
- Python s'execute avec Brython dans l'onglet ; ce n'est pas une execution sur
  le serveur.
- SQL s'execute dans SQLite/WebAssembly dans l'onglet.

Les liens de partage contiennent le code en clair sous une forme Base64. Toute
personne possedant le lien peut le lire.

## Stockage et telemetrie

Les ateliers utilisent le stockage local du navigateur. Une telemetrie limitee
peut envoyer le domaine, le produit et le chemin consulte au service configure.
La page d'accueil charge egalement un service tiers de discussion en ligne.
Ces integrations doivent etre mentionnees dans la politique de confidentialite
du site deploye ; l'affirmation « sans cookies » ne couvre pas automatiquement
les services tiers.

## Serveurs locaux

Sur le réseau HTTP de l'école, le relais Python transmet temporairement en mémoire
les réponses aux lectures de fichiers, à `input()` et aux appels Turtle. Il
n'exécute pas le code élève et n'écrit pas ces données sur disque. Chaque
exécution utilise un jeton aléatoire distinct ; les requêtes JSON vérifient
l'origine, les réponses ne sont pas mises en cache et la mémoire est bornée.
Les jetons et les contenus ne figurent pas dans les URL ou les journaux d'accès.
Comme le reste du site en HTTP, ces échanges ne sont pas chiffrés sur le réseau.

Le serveur HTTP de fichiers exige une authentification et limite la taille des
requêtes. Les fichiers caches et la base de metadonnees ne sont pas servis. Les
chemins sont resolus physiquement pour empecher une sortie via un lien
symbolique.

Le serveur FTP est non chiffre. Il doit rester sur un reseau local de confiance
et etre arrete a la fin du cours.

## Signalement

Lors d'un signalement, fournir le composant, la version du navigateur, les
etapes de reproduction et l'impact. Ne pas joindre de secrets ni de donnees
d'eleves. Les dependances et services externes doivent etre verifies separement.
