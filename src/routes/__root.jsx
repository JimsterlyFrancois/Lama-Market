import { useEffect, useState } from "react";
import {
  createRootRoute,
  HeadContent,
  Outlet,
  Scripts,
} from "@tanstack/react-router";
import { Moon, Sun } from "lucide-react";
import appCss from "../styles/app.css?url";
import AccountMenu from "../components/site/AccountMenu";

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Lama Market — Votre marché en ligne" },
      {
        name: "description",
        content: "Découvrez les produits disponibles chez Lama Market, à Cap-Haïtien.",
      },
      { name: "theme-color", content: "#176b45" },
      { property: "og:type", content: "website" },
      { property: "og:site_name", content: "Lama Market" },
      { property: "og:title", content: "Lama Market — Qualité, variété au meilleur prix" },
      { property: "og:description", content: "Découvrez les produits disponibles chez Lama Market, à Cap-Haïtien." },
      { property: "og:image", content: "/images/lama-market-cover.webp" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:image", content: "/images/lama-market-cover.webp" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "icon", type: "image/svg+xml", href: "/images/lama-market-logo.svg" },
    ],
  }),
  component: RootDocument,
});

function RootDocument() {
  return (
    <html lang="fr">
      <head>
        <HeadContent />
      </head>
      <body>
        <Outlet />
        <div className="global-floating-actions"><AccountMenu /><GlobalThemeToggle /></div>
        <Scripts />
      </body>
    </html>
  );
}

function GlobalThemeToggle() {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem("lama-market-theme");
      const preferred = saved === "dark" || (!saved && window.matchMedia?.("(prefers-color-scheme: dark)").matches);
      setDark(Boolean(preferred));
      document.documentElement.dataset.theme = preferred ? "dark" : "light";
    } catch {
      document.documentElement.dataset.theme = "light";
    }
  }, []);

  function toggleTheme() {
    const next = !dark;
    setDark(next);
    document.documentElement.dataset.theme = next ? "dark" : "light";
    try {
      window.localStorage.setItem("lama-market-theme", next ? "dark" : "light");
    } catch {
      // The visual mode still changes when storage is unavailable.
    }
  }

  return (
    <button
      type="button"
      className="global-theme-toggle"
      onClick={toggleTheme}
      aria-label={dark ? "Activer le mode clair" : "Activer le mode sombre"}
      title={dark ? "Mode clair" : "Mode sombre"}
    >
      {dark ? <Sun size={19} aria-hidden="true" /> : <Moon size={19} aria-hidden="true" />}
      <span>{dark ? "Mode clair" : "Mode sombre"}</span>
    </button>
  );
}
