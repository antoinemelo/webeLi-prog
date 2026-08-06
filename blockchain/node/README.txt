#### Prénom / BlockchainCryptomonnaie-ClientLocalTP00
---
[Bienvenue]::

# BLOCKCHAIN / CRYPTOMONNAIE

Ce système blockchain minimaliste, mais fonctionnelle, a été conçue pour l’enseignement. Il permet d’explorer les **principes fondamentaux des cryptomonnaies**,  
notamment la signature numérique, la validation décentralisée (Proof of Work), et la synchronisation entre pairs (P2P).

---

## Présentation

Ce projet repose sur deux environnements complémentaires :

| Composant | Langage | Rôle principal |
|------------|----------|----------------|
| **Serveur PHP** | PHP | Stockage et synchronisation en ligne des blocs et transactions |
| **Client local** | JavaScript | Interface autonome, minage local et communication P2P (WebRTC) |

Chacun peut :
- créer un **compte local** (avec clés RSA générées côté navigateur ou serveur),
- effectuer des **transactions signées** (émission, réception),
- **miner** des blocs localement (preuve de travail),
- **diffuser** les transactions ou blocs aux autres pairs,
- **synchroniser** la blockchain avec le serveur central.

---

## Objectif pédagogique

Ce projet permet d’illustrer concrètement :

- le fonctionnement **d’une blockchain décentralisée** 
- les notions de **preuve de travail et de consensus**
- la **signature numérique** et la **vérification cryptographique**
- l’intérêt du **stockage distribué** et de la **synchronisation P2P**

Les utilisateurs peuvent ainsi expérimenter les échanges, observer le minage, et comprendre les enjeux de fiabilité et de sécurité.

---

## Structure des fichiers

```
/blockchain/
│
├── main/ — Version serveur (PHP) également disponible sous bis/
│   ├── index.php — Interface serveur
│   ├── auth.php — Authentification / gestion comptes
│   ├── chain.php — Fonctions blockchain
│   ├── db.php — Connexion SQL
│   ├── config.php — Paramètres globaux
│   ├── api.php — Routes (peers, chain, pool)
│   └── style.css — Apparence Bootstrap claire
│
├── node/
│   └── signal.php — WebRTC simple d'indication de sa présence
│
├── client/
│   ├── index.html — Interface client
│   ├── app.js — Blockchain + P2P + minage + synchro
│   └── style.css — Thème clair (Bootstrap)
│
└── README.txt
```

---

## Installation

Téléchargez le dossier `/client/` et ouvrir `index.html` dans un navigateur (Chrome, Edge, Firefox, etc.).

Le client :
- utilise **sql.js** (SQLite embarqué en WebAssembly),
- permet un **minage local**,
- et peut **se synchroniser avec le serveur PHP**.

---

## Fonctionnalités principales

| Fonction | Description |
|-----------|-------------|
| **Création de compte** | Génération locale d’un couple RSA (clé publique/privée) et d’une adresse unique |
| **Connexion persistante** | Le compte reste actif après rechargement (stockage local) |
| **Transactions signées** | Chaque opération est signée numériquement (garantie d’authenticité) |
| **Proof of Work (PoW)** | Minage local avec difficulté paramétrable |
| **Consensus** | Remplacement automatique de la chaîne si une version plus longue est trouvée |
| **P2P WebRTC** | Communication directe entre navigateurs (échange de blocs/transactions) |
| **Synchronisation serveur** | Téléchargement / envoi de la chaîne via l’API PHP |
| **Export / Import chiffré** | Sauvegarde locale de la base SQLite chiffrée (AES-GCM) |

---

## Exemple de scénario

Création d'un **compte local**.  
Une clé publique (PEM RSA) et une adresse unique sont attribuées.

Effectuer une **transaction** vers un autre utilisateur (adresse cible).  
La transaction est signée puis ajoutée au **pool**.

**Miner un bloc** localement.  
Le proof of work valide les transactions et ajoute le bloc à la chaîne.

**Diffuser** le bloc ou le pool via P2P, ou **synchronise** avec le serveur.  
Les autres pairs reçoivent la mise à jour et mettent à jour leur propre chaîne.

---

## Concepts pédagogiques abordés

- Hachage (SHA-256)
- Signatures RSA
- Chaînage des blocs (`prev_hash`)
- Proof of work et nonce
- Consensus distribué
- Communication P2P (WebRTC)
- Base de données SQLite
- Export chiffré AES-GCM

---

## Sécurité

Ce projet est volontairement **simplifié pour l’enseignement** :
- Les clés RSA sont stockées localement sans chiffrement fort
- Le PoW est faible (difficulté réglée au minimum)
- Le réseau P2P repose sur un serveur de signalisation central
- L’objectif est pédagogique, **pas de créer une vraie cryptomonnaie**

**Remarque**  
La protection est *locale* (côté navigateur). Ne stockez pas le fichier `.db` sur un espace public sans chiffrement supplémentaire.

---

## Technologies utilisées

| Composant | Stack |
|------------|-------|
| Frontend | HTML5, Bootstrap 5, JavaScript |
| Base de données | SQLite et WebAssembly |
| Backend | PHP + PDO |
| P2P | WebRTC + Signalisation via PHP |
| Sécurité | RSA (OpenSSL), SHA-256, AES-GCM (WebCrypto API) |

---

## Licence

Projet libre à usage éducatif.  
(c) 2025 InformaticLi — Reproduction et usage autorisés à des fins pédagogiques.

---

**MVP éducatif — PHP + SQLite + JS + WebRTC — Signatures RSA — Proof of Work — Consensus distribué**
