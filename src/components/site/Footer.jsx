import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Instagram, Facebook, Youtube, Send, Check, ArrowRight } from "lucide-react";
import LlamaMark from "@/components/site/LlamaMark";
import { subscribeNewsletter } from "@/lib/server-fns";
import { toast } from "sonner";

const COLUMNS = [
  {
    title: "À propos de Lama Market",
    links: [
      { label: "Notre histoire", to: "/aide", hash: "histoire" },
      { label: "Nos producteurs", to: "/aide", hash: "producteurs" },
      { label: "Engagements & qualité", to: "/aide", hash: "engagements" },
      { label: "Nous rejoindre", to: "/aide", hash: "emplois" },
    ],
  },
  {
    title: "Service Client",
    links: [
      { label: "Suivre ma commande", to: "/aide", hash: "suivi" },
      { label: "Livraison & délais", to: "/aide", hash: "livraison" },
      { label: "Retours & remboursements", to: "/aide", hash: "retours" },
      { label: "Nous contacter", to: "/aide", hash: "contact" },
    ],
  },
  {
    title: "Informations Légales",
    links: [
      { label: "Mentions légales", to: "/aide", hash: "mentions" },
      { label: "Conditions générales de vente", to: "/aide", hash: "cgv" },
      { label: "Politique de confidentialité", to: "/aide", hash: "confidentialite" },
      { label: "Cookies", to: "/aide", hash: "cookies" },
    ],
  },
];

const SOCIALS = [
  { label: "Instagram", icon: Instagram, href: "https://www.instagram.com" },
  { label: "Facebook", icon: Facebook, href: "https://www.facebook.com" },
  { label: "YouTube", icon: Youtube, href: "https://www.youtube.com" },
];

export default function Footer() {
  const subscribe = useServerFn(subscribeNewsletter);
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState("");

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim())) {
      setError("Merci d'indiquer une adresse e-mail valide.");
      return;
    }
    setError("");
    setStatus("loading");
    try {
      const result = await subscribe({ data: { email: email.trim() } });
      setStatus("done");
      setEmail("");
      toast.success(
        result?.status === "already" ? "Vous êtes déjà inscrit" : "Bienvenue dans la famille Lama",
        { description: "Votre code LAMA15 arrive dans votre boîte mail." }
      );
    } catch {
      setStatus("idle");
      setError("L'inscription n'a pas abouti. Merci de réessayer dans un instant.");
    }
  };

  return (
    <footer className="mt-4 border-t border-black/5 bg-primary text-primary-foreground">
      <div className="mx-auto w-full max-w-[1280px] px-5 py-14 sm:px-8 sm:py-20">
        <div className="grid gap-12 lg:grid-cols-[1.1fr_1.4fr] lg:gap-16">
          <div>
            <div className="flex items-center gap-3">
              <span className="grid h-11 w-11 place-items-center rounded-2xl bg-primary-foreground/10 text-primary-foreground">
                <LlamaMark className="h-6 w-6" />
              </span>
              <span className="font-heading text-xl font-extrabold tracking-tight">
                Lama Market
              </span>
            </div>
            <p className="mt-5 max-w-sm text-[15px] leading-relaxed text-primary-foreground/70">
              Le marché chaleureux des produits du quotidien : épicerie locale, maison, beauté,
              high-tech et mode — sélectionnés avec soin et livrés chez vous.
            </p>
            <div className="mt-7 flex items-center gap-2.5">
              {SOCIALS.map((social) => {
                const Icon = social.icon;
                return (
                  <a
                    key={social.label}
                    href={social.href}
                    target="_blank"
                    rel="noreferrer noopener"
                    aria-label={social.label}
                    className="grid h-10 w-10 place-items-center rounded-full bg-primary-foreground/10 text-primary-foreground/85 transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                  >
                    <Icon className="h-4 w-4" />
                  </a>
                );
              })}
            </div>
          </div>

          <div className="grid gap-10 sm:grid-cols-3">
            {COLUMNS.map((column) => (
              <div key={column.title}>
                <h3 className="font-heading text-[13px] font-bold uppercase tracking-[0.14em] text-primary-foreground/55">
                  {column.title}
                </h3>
                <ul className="mt-4 grid gap-2.5">
                  {column.links.map((link) => (
                    <li key={link.label}>
                      <Link
                        to={link.to}
                        hash={link.hash}
                        className="text-[13.5px] leading-snug text-primary-foreground/80 transition-colors hover:text-accent"
                      >
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-14 rounded-[32px] border border-primary-foreground/15 bg-primary-foreground/[0.06] p-6 sm:p-9">
          <div className="grid gap-6 lg:grid-cols-[1fr_1fr] lg:items-center lg:gap-12">
            <div>
              <h3 className="font-heading text-xl font-extrabold leading-tight sm:text-2xl">
                Recevez nos meilleures offres
              </h3>
              <p className="mt-2 max-w-md text-[13.5px] leading-relaxed text-primary-foreground/65">
                Une newsletter par semaine : nouveautés, arrivages locaux et bons plans. Pas de
                spam, désinscription en un clic.
              </p>
            </div>
            <form onSubmit={handleSubmit} className="flex flex-col gap-2">
              <div className="flex flex-col gap-2 sm:flex-row">
                <label htmlFor="newsletter-email" className="sr-only">
                  Adresse e-mail
                </label>
                <input
                  id="newsletter-email"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="votre@email.com"
                  className="min-w-0 flex-1 rounded-full border border-primary-foreground/20 bg-primary-foreground/10 px-5 py-3.5 text-sm text-primary-foreground placeholder:text-primary-foreground/45 focus:border-accent focus:outline-none"
                />
                <button
                  type="submit"
                  disabled={status === "loading"}
                  className="inline-flex items-center justify-center gap-2 rounded-full bg-accent px-6 py-3.5 text-sm font-semibold text-accent-foreground transition-all duration-300 hover:bg-white hover:text-primary disabled:opacity-70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-primary"
                >
                  {status === "done" ? (
                    <>
                      <Check className="h-4 w-4" /> Inscrit
                    </>
                  ) : status === "loading" ? (
                    "Envoi…"
                  ) : (
                    <>
                      Je m'inscris <Send className="h-4 w-4" />
                    </>
                  )}
                </button>
              </div>
              {error && <p className="text-[12.5px] text-amber-200">{error}</p>}
              {status === "done" && !error && (
                <p className="flex items-center gap-1.5 text-[12.5px] text-primary-foreground/80">
                  <ArrowRight className="h-3.5 w-3.5 text-accent" />
                  C'est noté — surveillez votre boîte mail pour le code LAMA15.
                </p>
              )}
            </form>
          </div>
        </div>

        <div className="mt-10 flex flex-col gap-3 border-t border-primary-foreground/10 pt-6 text-[12.5px] text-primary-foreground/55 sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} Lama Market. Tous droits réservés.</p>
          <p className="flex items-center gap-2">
            Paiement sécurisé · Livraison suivie · Service client 7j/7
          </p>
        </div>
      </div>
    </footer>
  );
}
