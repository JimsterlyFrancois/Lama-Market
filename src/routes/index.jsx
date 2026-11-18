import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  Search, ShoppingBasket, Leaf, Truck, ShieldCheck, Clock3,
  ChevronRight, SlidersHorizontal, PackageSearch, RefreshCw,
} from "lucide-react";
import { getCatalog, addCartItem } from "../lib/commerce";
import { authClient, getAccessToken } from "../lib/auth-client";

export const Route = createFileRoute("/")({
  component: HomePage,
});

const CATEGORIES = [
  { value: "tous", label: "Tous les produits" },
  { value: "epicerie", label: "Épicerie" },
  { value: "maison", label: "Maison" },
  { value: "beaute", label: "Beauté" },
  { value: "electronique", label: "Électronique" },
  { value: "mode", label: "Mode" },
  { value: "bons-plans", label: "Bons plans" },
];

const money = new Intl.NumberFormat("fr-HT", {
  style: "currency",
  currency: "HTG",
  maximumFractionDigits: 2,
});

function formatPrice(value) {
  const amount = Number(value);
  return Number.isFinite(amount) ? money.format(amount) : "Prix sur demande";
}

function HomePage() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("tous");
  const [sort, setSort] = useState("featured");

  async function loadProducts() {
    setLoading(true);
    setError("");
    try {
      const result = await getCatalog();
      setProducts(result.products ?? []);
    } catch (loadError) {
      setError(loadError?.message || "Impossible de charger le catalogue pour le moment.");
      setProducts([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadProducts();
  }, []);

  const visibleProducts = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("fr");
    let result = products.filter((product) => {
      const matchesCategory = category === "tous" || product.category === category;
      const searchable = [product.name, product.description, product.category]
        .filter(Boolean)
        .join(" ")
        .toLocaleLowerCase("fr");
      return matchesCategory && (!normalized || searchable.includes(normalized));
    });

    if (sort === "price-asc") result = [...result].sort((a, b) => Number(a.price) - Number(b.price));
    if (sort === "price-desc") result = [...result].sort((a, b) => Number(b.price) - Number(a.price));
    if (sort === "name") result = [...result].sort((a, b) => a.name.localeCompare(b.name, "fr"));
    return result;
  }, [products, query, category, sort]);

  return (
    <main className="site-shell">
      <div className="announcement">
        <span><Truck size={15} /> Votre marché de proximité, en ligne</span>
        <span className="announcement-note">Lama Market · Cap-Haïtien</span>
      </div>

      <header className="site-header">
        <a className="brand" href="/" aria-label="Lama Market, accueil">
          <span className="brand-mark"><img src="/images/lama-market-logo.svg" alt="" aria-hidden="true" className="brand-logo-icon" width="32" height="32" /></span>
          <span className="brand-name">Lama <strong>Market</strong><small>FRAÎCHEUR & BONNES AFFAIRES</small></span>
        </a>
        <nav className="header-links" aria-label="Navigation principale">
          <a className="active" href="#catalogue">Accueil</a>
          <a href="#categories">Catégories</a>
          <a href="#avantages">Nos engagements</a>
        </nav>
        <a className="header-cta" href="#catalogue"><ShoppingBasket size={17} /> Voir les produits</a>
      </header>

      <section className="hero">
        <div className="hero-copy">
          <span className="eyebrow"><span className="eyebrow-dot" /> LE BON CHOIX, AU BON ENDROIT</span>
          <h1>Vos essentiels,<br />à portée de <em>clic.</em></h1>
          <p>Parcourez le catalogue Lama Market et retrouvez vos produits du quotidien dans un espace simple, pratique et accessible.</p>
          <a className="primary-button" href="#catalogue">Découvrir le catalogue <ChevronRight size={18} /></a>
          <div className="hero-trust"><span><ShieldCheck size={16} /> Sélection de produits</span><span><Clock3 size={16} /> Catalogue actualisé</span></div>
        </div>
        <div className="hero-art hero-cover-art">
          <img
            className="hero-cover-image"
            src="/images/lama-market-cover.webp"
            alt="Une cliente découvre les produits et les rayons de Lama Market"
            width="384"
            height="384"
            fetchPriority="high"
          />
          <span className="hero-image-tag">Lama Market · Qualité, variété au meilleur prix</span>
        </div>
      </section>

      <section className="benefits" id="avantages">
        <div><span className="benefit-icon"><Truck size={19} /></span><span><strong>Pratique</strong><small>Un catalogue accessible partout</small></span></div>
        <div><span className="benefit-icon"><ShieldCheck size={19} /></span><span><strong>Clair et transparent</strong><small>Prix et informations visibles</small></span></div>
        <div><span className="benefit-icon"><img src="/images/lama-market-logo.svg" alt="" aria-hidden="true" className="service-logo-icon" width="25" height="25" /></span><span><strong>Votre marché</strong><small>Une sélection pour le quotidien</small></span></div>
      </section>

      <section className="catalog-section" id="catalogue">
        <div className="section-heading">
          <div><span className="section-kicker">LE CATALOGUE</span><h2>Tous les produits</h2><p>Explorez les articles disponibles chez Lama Market.</p></div>
          <span className="product-count">{products.length} produit{products.length > 1 ? "s" : ""}</span>
        </div>

        <div className="catalog-tools">
          <label className="search-box">
            <Search size={19} />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Rechercher un produit..." aria-label="Rechercher un produit" />
            {query && <button type="button" onClick={() => setQuery("")} aria-label="Effacer la recherche">×</button>}
          </label>
          <label className="sort-box"><SlidersHorizontal size={17} /><span className="sr-only">Trier les produits</span>
            <select value={sort} onChange={(event) => setSort(event.target.value)}>
              <option value="featured">Ordre conseillé</option>
              <option value="price-asc">Prix croissant</option>
              <option value="price-desc">Prix décroissant</option>
              <option value="name">Nom du produit</option>
            </select>
          </label>
        </div>

        <div className="category-list" id="categories" aria-label="Filtrer par catégorie">
          {CATEGORIES.map((item) => (
            <button key={item.value} type="button" className={category === item.value ? "category-chip selected" : "category-chip"} onClick={() => setCategory(item.value)}>
              {item.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="catalog-message"><span className="loader" /><strong>Chargement du catalogue...</strong></div>
        ) : error ? (
          <div className="catalog-message error-message">
            <PackageSearch size={34} />
            <strong>Catalogue en attente de connexion</strong>
            <p>{error}</p>
            <button className="retry-button" type="button" onClick={loadProducts}><RefreshCw size={16} /> Réessayer</button>
          </div>
        ) : visibleProducts.length === 0 ? (
          <div className="catalog-message">
            <PackageSearch size={34} />
            <strong>{products.length ? "Aucun produit ne correspond à votre recherche." : "Aucun produit disponible pour le moment."}</strong>
            <p>{products.length ? "Essayez un autre mot-clé ou une autre catégorie." : "Les produits ajoutés au catalogue apparaîtront ici."}</p>
            {products.length > 0 && <button className="retry-button" type="button" onClick={() => { setQuery(""); setCategory("tous"); }}>Réinitialiser les filtres</button>}
          </div>
        ) : (
          <div className="product-grid">
            {visibleProducts.map((product) => <ProductCard key={product.id} product={product} onAdd={async () => { try { const session = await authClient?.getSession(); if (!session?.data?.user) { window.location.href = "/auth"; return; } const token = await getAccessToken(); await addCartItem({ data: { token, productId: product.id, quantity: 1 } }); window.location.href = "/panier"; } catch (error) { window.alert(error.message || "Impossible d’ajouter ce produit."); } }} />)}
          </div>
        )}
      </section>

      <footer className="site-footer">
        <a className="brand footer-brand" href="#"><span className="brand-mark"><img src="/images/lama-market-logo.svg" alt="" aria-hidden="true" className="brand-logo-icon" width="30" height="30" /></span><span className="brand-name">Lama <strong>Market</strong><small>FRAÎCHEUR & BONNES AFFAIRES</small></span></a>
        <p>Votre marché en ligne, à Cap-Haïtien.</p>
        <span>© {new Date().getFullYear()} Lama Market. Tous droits réservés.</span>
      </footer>
    </main>
  );
}

function ProductCard({ product, onAdd }) {
  const categoryName = CATEGORIES.find((item) => item.value === product.category)?.label || product.category;
  const available = Number(product.stock ?? 0) > 0;
  return (
    <article className="product-card">
      <div className="product-image-wrap">
        {product.image_url ? <img className="product-image" src={product.image_url} alt={product.name} loading="lazy" /> : <div className="product-placeholder"><img src="/images/lama-market-logo.svg" alt="" className="product-placeholder-logo" width="52" height="52" /><span>Lama Market</span></div>}
        {product.badge && <span className="product-badge">{product.badge}</span>}
        {!available && <span className="stock-badge">Épuisé</span>}
      </div>
      <div className="product-info">
        <span className="product-category">{categoryName}</span>
        <h3>{product.name}</h3>
        {product.description && <p className="product-description">{product.description}</p>}
        <div className="product-bottom">
          <div><strong className="product-price">{formatPrice(product.price)}</strong>{product.old_price && <del>{formatPrice(product.old_price)}</del>}</div>
          <span className={available ? "stock-status" : "stock-status unavailable"}>{available ? "Disponible" : "Indisponible"}</span>
        </div>
        <button className="add-cart-button" type="button" disabled={!available} onClick={onAdd}>Ajouter au panier</button>
      </div>
    </article>
  );
}
