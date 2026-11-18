# Audit de migration — Lama Market

## Résultat du retrait de Base44

La branche de migration retire les dépendances d'exécution et les points d'entrée propres à Base44 :

- suppression du client `@base44/sdk` et du fichier `src/api/base44Client.js` ;
- suppression du flux OAuth/MCP de consentement propre à Base44 ;
- remplacement des appels Base44 pour l'inscription et la récupération de mot de passe par Supabase Auth ;
- suppression de la configuration `base44/config.jsonc` ;
- conservation des six anciennes définitions d'entités dans `docs/data-model/`, uniquement comme documentation JSONC.

Le catalogue actif interroge Supabase via `src/lib/supabase.js`. La variable publique `VITE_SUPABASE_URL` et la clé publique/anon sont requises ; aucune clé de service ne doit être exposée au navigateur.

## Images et identité de marque

La couverture du site est stockée dans `public/images/lama-market-cover.webp`. Le logo lama est stocké séparément au format SVG dans `public/images/lama-market-logo.svg`, et utilisé dans l'en-tête, les services et le pied de page.

## Périmètre fonctionnel à distinguer

Le retrait de Base44 ne signifie pas que toutes les fonctions de commerce sont achevées. La page d'accueil active affiche un catalogue Supabase avec recherche, filtres et tri. Les parcours Auth ont été adaptés à Supabase mais doivent encore être reliés aux routes du routeur. Les commandes, paiements, administration, messages et stocks nécessitent des fonctions backend supplémentaires, des politiques RLS et des tests dédiés.

## Vérifications

Une revue statique des appels Base44 a identifié les anciens points d'entrée dans le client API, l'inscription, la réinitialisation du mot de passe et la page de consentement OAuth. Ces références d'exécution sont supprimées ou remplacées dans cette branche. Le build et le parcours réel Supabase doivent être exécutés avec les variables de projet avant fusion et déploiement.
