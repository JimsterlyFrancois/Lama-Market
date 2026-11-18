import {
  createRootRoute,
  HeadContent,
  Outlet,
  Scripts,
} from "@tanstack/react-router";
import appCss from "../styles/app.css?url";

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
        <Scripts />
      </body>
    </html>
  );
}
