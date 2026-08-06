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
