# Lama Market

Lama Market est une boutique en ligne autonome construite avec React, TanStack Start et Supabase. Le dépôt ne nécessite pas le SDK, l'hébergement ni les services d'exécution Base44.

## Développement local

1. Installer Node.js `>=22.12.0`.
2. Installer les dépendances avec `npm install`.
3. Copier `.env.example` vers `.env.local`.
4. Renseigner `VITE_SUPABASE_URL` et `VITE_SUPABASE_PUBLISHABLE_KEY` (ou `VITE_SUPABASE_ANON_KEY`) depuis le projet Supabase.
5. Lancer `npm run dev` puis ouvrir l'adresse indiquée par Vite.

## Catalogue

La page d'accueil lit les produits actifs depuis `public.products` dans Supabase. La migration SQL correspondante se trouve dans `supabase/migrations/202611170001_create_products.sql`. Les clés de service et autres secrets doivent rester dans les variables d'environnement côté serveur et ne doivent jamais être préfixés par `VITE_`.

## Identité visuelle

- Couverture principale : `public/images/lama-market-cover.webp`.
- Logo vectoriel indépendant : `public/images/lama-market-logo.svg`.
- Le logo SVG est utilisé dans l'en-tête, les éléments de service et le pied de page.

## Périmètre actuel

Le catalogue, sa recherche, ses filtres et son tri sont la partie active de la page d'accueil. Les parcours de connexion, d'inscription et de récupération de mot de passe ont été adaptés à Supabase Auth, mais leur routage et leur configuration doivent être vérifiés avant ouverture aux clients. Les commandes, le paiement, la gestion du stock, l'administration et le panier connecté nécessitent encore leurs propres fonctions et règles d'accès Supabase.

Les anciens schémas d'entités ont été conservés sous `docs/data-model/` comme documentation de migration ; ils ne sont pas chargés au runtime.
