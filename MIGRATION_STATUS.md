# Statut de migration — Lama Market

La branche `feature/standalone-lama-branding` prépare une version autonome de Lama Market.

## Réalisé dans cette branche

- Retrait du client SDK Base44 et de la configuration d'application Base44.
- Remplacement des appels d'inscription, de connexion et de récupération de mot de passe par Supabase Auth.
- Conservation des définitions historiques de données dans `docs/data-model/` sans dépendance runtime.
- Ajout d'une couverture de site locale et d'un logo SVG indépendant.
- Intégration du visuel de marque dans l'en-tête, les repères de services, les images de remplacement du catalogue et le pied de page.
- Ajout de métadonnées Open Graph, Twitter et d'une icône de site.

## Configuration et limites

Les clés publiques Supabase sont à définir dans `.env.local` en développement et dans l'hébergeur en production. Les redirections d'e-mail et la confirmation d'inscription doivent être configurées dans Supabase Auth.

La page d'accueil active est le catalogue. Les routes d'authentification, l'expérience panier/commande, les paiements, le stock et l'administration devront faire l'objet de tests et d'implémentations spécifiques avant la mise en production complète.

La branche principale n'est pas modifiée par ce travail. Les changements sont proposés séparément dans une Pull Request.
