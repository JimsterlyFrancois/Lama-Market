# Lama Market — architecture fonctionnelle et technique

## Décision commerciale

Lama Market est une boutique unique qui vend ses propres produits. Il n'existe ni vendeurs tiers, ni boutiques vendeurs, ni commissions marketplace. Les produits, les prix, les stocks, les commandes et le service client relèvent de Lama Market.

La livraison est assurée par des livreurs employés ou mandatés par Lama Market. Les livreurs sont des comptes à rôle limité, créés ou autorisés par l'administration.

## Principes d'architecture

- Frontend : TanStack Start / React, hébergé sur Vercel.
- Serveur applicatif : handlers serveur TanStack Start exécutés sur Vercel. Les accès à la base et les opérations commerciales passent par le serveur.
- Données : Neon PostgreSQL.
- Identité : Neon Auth (Managed Better Auth déjà activé sur le projet Neon identifié). Les profils métier référencent `neon_auth."user".id`; les rôles métier sont conservés dans les tables applicatives et ne sont jamais attribuables par un formulaire public.
- Images : Neon Object Storage, avec contrôle des types, tailles et droits d'upload.
- Monnaie principale : HTG.
- Source de vérité du stock : `products.stock`, avec journal des mouvements et réservations transactionnelles.
- Déploiement : branche de fonctionnalité et PR vers `main`; aucune fusion ni mise en production sans validation.

## Espaces et rôles

### Visiteur
- Accueil, catégories, recherche, filtres, fiches produits et disponibilité.
- Peut préparer un panier local; la validation de commande nécessite une session client.

### Client
- Profil, téléphones et adresses.
- Panier persistant, validation, commandes, paiements, historique et suivi de livraison.
- Accès uniquement à ses propres données.

### Administrateur
- Gestion des produits, catégories, images, prix, promotions et stocks.
- Gestion des clients, commandes, paiements, zones et tarifs de livraison.
- Création/désactivation des comptes livreurs et affectation des livraisons.
- Rapports, paramètres de boutique et journal d'audit.
- Les permissions administratives sont vérifiées côté serveur à chaque action.

### Livreur
- Accès à son profil et uniquement aux livraisons qui lui sont affectées.
- Consultation des informations nécessaires à la remise de la commande.
- Mise à jour des étapes autorisées et saisie du résultat, d'une note ou d'une preuve de remise.
- Aucun accès au catalogue d'administration, aux paiements complets, aux autres clients ou aux autres livreurs.

## Parcours commerciaux

### Catalogue
L'administrateur crée un produit, renseigne son SKU, son nom, sa description, sa catégorie, son prix HTG, son stock, son seuil d'alerte et ses photos. Un produit actif et en stock apparaît dans le catalogue public. Les prix et la disponibilité sont toujours relus côté serveur lors de la commande.

### Panier et commande
Le panier contient des références de produits et des quantités, pas des prix faisant autorité. Au checkout, le serveur relit les prix, vérifie les produits actifs, contrôle le stock, valide l'adresse et calcule sous-total, réduction, frais de livraison et total. Une transaction atomique crée la commande, ses lignes et les réservations de stock. Une clé d'idempotence évite les commandes dupliquées. Les réservations expirées ou annulées sont libérées.

### Paiement
Le paiement à la livraison est prévu dès la première version. MonCash et NatCash sont des intégrations conditionnelles : elles ne seront activées qu'après obtention et vérification des accès marchands et de la documentation officielle. Le statut d'un paiement électronique ne peut être confirmé que par une notification serveur authentifiée ou une vérification serveur-à-serveur. Les captures d'écran ne constituent pas une preuve de paiement. Lama Market ne stocke pas les numéros de carte bancaire.

### Stock
`products.stock` représente le stock disponible avant réservation. Chaque mouvement est journalisé. Les réservations réduisent la quantité disponible au checkout; elles sont consommées à la confirmation du paiement ou du paiement à la livraison, et libérées en cas d'expiration/annulation. Les opérations de stock doivent être atomiques et empêcher les quantités négatives.

### Livraison interne
1. Une commande payée ou validée en paiement à la livraison devient prête à préparer.
2. L'administration prépare le colis et affecte un livreur actif.
3. Le livreur voit la mission dans son espace.
4. Le livreur passe par les statuts autorisés : affectée, en préparation, en cours de livraison, livrée, échec de livraison, retour.
5. La remise est confirmée avec date/heure et, si configuré, nom du réceptionnaire ou preuve.
6. Chaque événement est conservé. Une livraison échouée peut être reprogrammée ou retournée.
Les frais et délais sont configurables par zone. Le retrait sur place pourra être ajouté comme méthode distincte si un point de retrait existe.

## États indépendants

- Commande : `pending`, `confirmed`, `preparing`, `ready_for_delivery`, `completed`, `cancelled`.
- Paiement : `unpaid`, `pending`, `paid`, `failed`, `refunded`, `partially_refunded`, `cash_due`, `cash_collected`.
- Livraison : `unassigned`, `assigned`, `preparing`, `in_transit`, `delivered`, `failed`, `returned`.

Les trois cycles sont séparés pour ne pas confondre une commande préparée, un paiement confirmé et un colis effectivement remis.

## Données principales

- Identité et profils : Neon Auth, `customer_profiles`, `courier_profiles`, `user_roles`, `addresses`.
- Catalogue : `categories`, `products`, `product_images`.
- Stock : `stock_movements`, `stock_reservations`.
- Panier : `carts`, `cart_items`.
- Commandes : `orders`, `order_items`, `order_status_history`.
- Paiements : `payments`, `payment_transactions`.
- Livraison : `delivery_zones`, `delivery_rates`, `deliveries`, `delivery_events`.
- Fidélisation et suivi : `coupons`, `coupon_redemptions`, `notifications`.
- Exploitation : `store_settings`, `audit_logs`.

## Sécurité

- Aucun secret Neon, clé privée ou clé de prestataire dans le navigateur ou le dépôt.
- Pas d'accès direct du navigateur à PostgreSQL avec un rôle privilégié.
- Toute lecture/écriture métier passe par les handlers serveur et applique l'autorisation par rôle et propriétaire de ressource.
- Les identifiants des clients, livreurs et administrateurs sont liés à Neon Auth.
- Les opérations checkout, stock, paiement et annulation utilisent transactions et idempotence.
- Les événements de paiement sont vérifiés et dédupliqués.
- Les accès livreur sont limités aux missions affectées.
- Les changements administratifs sensibles sont audités.

## Ordre de réalisation

1. Auditer et stabiliser la base Vercel/TanStack Start de la PR catalogue.
2. Remplacer la dépendance catalogue Supabase par des endpoints serveur Neon.
3. Appliquer et tester les migrations sur une branche Neon isolée.
4. Construire comptes et profils.
5. Construire administration du catalogue et stockage des images.
6. Construire panier, checkout, commandes et réservations de stock.
7. Construire paiement à la livraison, puis étudier MonCash/NatCash.
8. Construire tableau de bord et gestion des livreurs.
9. Construire livraison, notifications et rapports.
10. Tests automatisés, tests de sécurité et recette sur prévisualisation avant toute production.

## Critères de fin

Un parcours complet doit fonctionner de bout en bout : publication d'un produit, création de compte, panier, validation, calcul fiable, réservation du stock, traitement administratif, paiement, affectation d'un livreur, preuve de remise, notification et historique client. Les scénarios d'échec (stock insuffisant, paiement refusé, double clic, annulation, livraison impossible) doivent également être testés.
