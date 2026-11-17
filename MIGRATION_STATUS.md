# Lama Market — état de la migration

Branche de travail : `migration/lama-market-foundation`

## Ce qui a été vérifié

Sur la branche principale `main`, le seul fichier racine dont le contenu a été confirmé est `README.md`, qui ne contient actuellement qu'une courte description du projet.

Les chemins suivants ont été recherchés sur `main` et ont retourné une absence (404) :
- `package.json`
- `wrangler.jsonc`
- `src/server.js`
- `src/lib/server-fns.js`

Cette vérification ciblée ne constitue pas un inventaire exhaustif de tout le dépôt.

## Éléments techniques transmis dans la conversation

Les instructions de projet indiquent une application Base44 construite avec TanStack Start et React 19, en JavaScript. Elles citent notamment les éléments suivants comme nécessaires au projet :
- configuration et scripts de dépendances (`package.json`, `vite.config.js`) ;
- point d'entrée serveur et configuration de déploiement (`src/server.js`, `wrangler.jsonc`) ;
- racine et routage (`src/routes/__root.jsx`, `src/router.jsx`, arbre de routes généré) ;
- client et middleware Base44 (`src/api/base44Client.js`, `src/lib/auth-middleware.js`, `src/start.js`) ;
- contexte d'authentification (`src/lib/AuthContext.jsx`) ;
- pages, composants, styles et logique métier.

Les fichiers de composants UI copiés dans la conversation ne représentent qu'une partie de l'application. Les pages métier, les données, les connexions de services et la configuration complète ne sont pas encore disponibles pour vérification.

## Premier fichier de fondation créé

`src/lib/server-auth.js` contient deux gardes serveur :
- `requireAuthenticatedUser(context)` : exige une identité utilisateur déjà authentifiée ;
- `requireUserRole(user, allowedRoles)` : vérifie le rôle lu côté serveur.

Important : ces fonctions sont des utilitaires. Elles ne créent pas à elles seules un système de connexion et ne remplacent pas l'authentification réelle, la vérification des droits sur chaque donnée, ni la protection des routes.

## Éléments à récupérer avant de reconstruire le fonctionnement complet

1. Le véritable `package.json` et les versions de dépendances.
2. Les fichiers de configuration Vite, TanStack Start et de déploiement.
3. Les routes/pages complètes de l'application.
4. Les composants et contextes utilisés par ces pages.
5. Les fonctions serveur, API et règles d'accès aux données.
6. Le schéma de données, les entités et les intégrations (authentification, stockage, paiement ou autres).
7. Les variables d'environnement requises, sans valeurs secrètes dans Git.

## Règles de sécurité de migration

- Ne jamais committer de fichier `.env`, clé API, mot de passe ou jeton.
- Les secrets doivent être configurés dans les variables d'environnement du fournisseur d'hébergement.
- Chaque opération serveur doit authentifier l'appelant, vérifier ses permissions et valider les entrées.
- Ne pas connecter une base de production ni lancer de déploiement avant d'avoir identifié les services et leurs règles.
- Ne pas fusionner cette branche dans `main` avant comparaison, tests et validation.

## Limite de cet audit

L'archive complète annoncée par Base44 n'a pas été fournie dans cette conversation. Les absences listées ci-dessus sont donc des absences confirmées dans les chemins vérifiés du dépôt, et non une preuve que tous les fichiers de l'application ont été recensés.
