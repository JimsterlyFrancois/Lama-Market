# Lama Market — état de la migration

## État vérifié du dépôt

Dépôt : `JimsterlyFrancois/Lama-Market`  
Branche de travail : `migration/lama-market-foundation`  
Branche principale préservée : `main`

Le dépôt principal contient actuellement 82 entrées suivies dans Git. Il contient des composants React, des écrans d'authentification, des écrans boutique et équipe, ainsi que les définitions d'entités Base44. Il ne contient pas encore le socle exécutable complet attendu pour une application TanStack Start.

## Éléments absents de la branche principale

Les chemins suivants n'ont pas été trouvés dans l'arbre Git de `main` :

- `package.json` et fichier de verrouillage npm/pnpm/yarn ;
- `vite.config.js` ;
- `wrangler.jsonc` ;
- `src/server.js` ;
- `src/start.js` ;
- `src/router.jsx` ;
- `src/routes/__root.jsx` et les routes de pages ;
- `src/lib/auth-middleware.js` ;
- `src/lib/AuthContext.jsx` ;
- `src/lib/app-params.js`, pourtant importé par `src/api/base44Client.js` ;
- les fonctions serveur et les points d'accès nécessaires aux opérations de la boutique.

L'absence de ces fichiers empêche de confirmer que le dépôt peut être installé, construit et exécuté comme un site autonome. La présence des composants visuels ne prouve pas que les actions, l'authentification et les données sont reliées.

## Éléments déjà présents

- composants boutique, panier, catalogue et compte ;
- composants d'administration et d'équipe ;
- composants de connexion, inscription et récupération de mot de passe ;
- définitions Base44 pour Product, Order, StaffMember, StaffNote, User et NewsletterSubscriber.

## Modifications isolées sur la branche de migration

- `.gitignore` : ignore les dépendances, fichiers générés et fichiers d'environnement locaux ;
- `src/lib/server-fns.js` : ajoute des gardes serveur élémentaires pour l'authentification et les rôles.

Ces gardes ne sont pas encore reliées aux routes ni aux fonctions serveur. Elles ne constituent donc pas, à elles seules, une protection complète.

## Points à résoudre avant un déploiement

1. Récupérer ou reconstituer les fichiers d'architecture originaux de l'export Base44.
2. Déterminer les versions exactes des dépendances et les scripts de build.
3. Reconnecter les entités et opérations de données à un backend réel.
4. Protéger chaque opération serveur par authentification, contrôle de rôle et validation des entrées.
5. Vérifier que les identifiants et secrets ne sont jamais présents dans le code client ou dans Git.
6. Exécuter installation, lint, build et tests fonctionnels avant tout déploiement.

## Limite de cet audit

Cet état décrit uniquement les fichiers actuellement visibles dans le dépôt Git. L'archive complète Base44 n'a pas été disponible pour une comparaison fichier par fichier. Les éléments indiqués comme absents sont absents du dépôt vérifié, mais peuvent exister dans l'export original non récupéré.
