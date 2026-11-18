import { useEffect, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { Search, Heart, ShoppingBag, ListChecks } from "lucide-react";
import ThemeToggle from "@/components/site/ThemeToggle";
import AccountMenu from "@/components/site/AccountMenu";
import { useCart } from "@/lib/cart";
import { NAV_LINKS } from "@/lib/catalog";
import { cn } from "@/lib/utils";

export default function Header() {
  const navigate = useNavigate();
  const { count, favorites } = useCart();
  const [query, setQuery] = useState("");
  const [bump, setBump] = useState(false);

  useEffect(() => {
    if (count === 0) return;
    setBump(true);
    const timer = setTimeout(() => setBump(false), 420);
    return () => clearTimeout(timer);
  }, [count]);

  const submitSearch = (event) => {
    event.preventDefault();
    const trimmed = query.trim();
    navigate({ to: "/boutique", search: trimmed ? { q: trimmed } : {} });
  };

  const renderSearch = (suffix) => (
    <form
      onSubmit={submitSearch}
      role="search"
      aria-label="Rechercher dans la boutique"
      className="group flex flex-1 items-center gap-2 rounded-full border border-border bg-card/90 pl-4 pr-1.5 py-1.5 shadow-[0_10px_30px_-24px_rgba(6,78,59,0.6)] transition-all duration-300 focus-within:border-primary/40 focus-within:shadow-[0_14px_34px_-22px_rgba(6,78,59,0.5)]"
    >
      <Search className="h-4 w-4 flex-none text-foreground/40" strokeWidth={2.2} />
      <label htmlFor={`lama-search-${suffix}`} className="sr-only">
        Rechercher un produit
      </label>
      <input
        id={`lama-search-${suffix}`}
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Rechercher un produit, une catégorie…"
        className="min-w-0 flex-1 bg-transparent py-2 text-sm text-foreground placeholder:text-foreground/40 focus:outline-none"
      />
      <button
        type="submit"
        className="flex-none rounded-full bg-primary px-4 py-2 text-[13px] font-semibold text-primary-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
      >
        Rechercher
      </button>
    </form>
  );

  return (
    <header className="sticky top-0 z-50 border-b border-black/5 bg-background/85 backdrop-blur-xl">
      <div className="mx-auto w-full max-w-[1280px] px-5 sm:px-8">
        <div className="flex items-center gap-3 py-3 sm:gap-6">
          <Link
            to="/"
            activeProps={{}}
            activeOptions={{ exact: true, includeSearch: false }}
            className="flex flex-none items-center gap-2.5 rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
            aria-label="Lama Market — accueil"
          >
            <img src="/images/lama-market-logo.svg" alt="Logo Lama Market" className="h-11 w-11 rounded-xl bg-white object-contain" />
            <span className="hidden font-heading text-[17px] font-extrabold leading-none tracking-tight text-primary sm:block">
              Lama Market
            </span>
          </Link>

          <div className="hidden flex-1 md:flex">{renderSearch("desktop")}</div>

          <div className="ml-auto flex flex-none items-center gap-0.5 sm:gap-1">
            <Link
              to="/produits"
              className="mr-1 inline-flex h-10 items-center gap-2 rounded-full bg-primary px-3 text-[13px] font-semibold text-primary-foreground transition-colors hover:bg-accent hover:text-accent-foreground sm:px-4"
            >
              <ListChecks className="h-4 w-4" />
              <span className="hidden sm:inline">Produits disponibles</span>
            </Link>
            <ThemeToggle />
            <AccountMenu />
            <Link
              to="/favoris"
              aria-label={`Mes favoris (${favorites.length})`}
              className="relative grid h-10 w-10 place-items-center rounded-full text-foreground/70 transition-colors hover:bg-secondary hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <Heart className="h-5 w-5" strokeWidth={1.9} />
              {favorites.length > 0 && (
                <span className="absolute -right-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">
                  {favorites.length}
                </span>
              )}
            </Link>
            <Link
              to="/panier"
              aria-label={`Mon panier (${count} articles)`}
              className="relative grid h-10 w-10 place-items-center rounded-full text-foreground/70 transition-colors hover:bg-secondary hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <ShoppingBag className="h-5 w-5" strokeWidth={1.9} />
              <span
                className={cn(
                  "absolute -right-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-accent px-1 text-[10px] font-bold text-accent-foreground transition-transform duration-300",
                  count === 0 && "opacity-0",
                  bump && "scale-[1.45]"
                )}
              >
                {count}
              </span>
            </Link>
          </div>
        </div>

        <div className="pb-3 md:hidden">{renderSearch("mobile")}</div>

        <nav
          aria-label="Catégories principales"
          className="-mx-1 flex items-center gap-1 overflow-x-auto pb-2.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {NAV_LINKS.map((link) => (
            <Link
              key={link.label}
              to={link.to}
              search={link.search}
              className="flex-none rounded-full px-3.5 py-2 text-[13px] font-semibold text-foreground/65 transition-colors hover:bg-secondary hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              {link.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
