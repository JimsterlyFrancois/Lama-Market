import { useState } from "react";
import { Check, Copy, Sparkles } from "lucide-react";
import { Link } from "@tanstack/react-router";
import Reveal from "@/components/site/Reveal";
import { toast } from "sonner";

const CODE = "LAMA15";

export default function PromoBanner() {
  const [copied, setCopied] = useState(false);

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(CODE);
      setCopied(true);
      toast.success("Code LAMA15 copié", { description: "Collez-le dans votre panier." });
      setTimeout(() => setCopied(false), 2200);
    } catch {
      toast.error("Copie impossible", { description: `Votre code : ${CODE}` });
    }
  };

  return (
    <section className="mx-auto w-full max-w-[1280px] px-5 py-16 sm:px-8 sm:py-24">
      <Reveal>
        <div className="relative overflow-hidden rounded-[36px] bg-primary px-6 py-12 text-primary-foreground sm:px-14 sm:py-16">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-accent/25 blur-3xl"
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -bottom-32 left-1/3 h-72 w-72 rounded-full bg-white/10 blur-3xl"
          />
          <div className="relative flex flex-col items-start gap-10 lg:flex-row lg:items-center lg:justify-between">
            <div className="max-w-xl">
              <span className="inline-flex items-center gap-2 rounded-full bg-white/12 px-3.5 py-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-accent">
                <Sparkles className="h-3.5 w-3.5" />
                Offre de bienvenue
              </span>
              <h2 className="mt-5 font-heading text-3xl font-extrabold leading-[1.05] tracking-tight sm:text-[2.75rem]">
                -15 % sur votre première commande
              </h2>
              <p className="mt-4 max-w-md text-[15px] leading-relaxed text-primary-foreground/75">
                Créez votre panier dès aujourd'hui et appliquez votre code au moment de payer.
                Valable sur tout le catalogue, sans minimum d'achat.
              </p>
            </div>

            <div className="flex w-full max-w-sm flex-col gap-4">
              <button
                type="button"
                onClick={copyCode}
                className="group flex items-center justify-between gap-4 rounded-3xl border border-dashed border-white/30 bg-white/10 px-6 py-5 text-left transition-colors hover:bg-white/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                <span className="flex flex-col">
                  <span className="text-[11px] uppercase tracking-[0.2em] text-primary-foreground/60">
                    Votre code
                  </span>
                  <span className="font-heading text-2xl font-extrabold tracking-[0.14em] text-white">
                    {CODE}
                  </span>
                </span>
                <span className="grid h-10 w-10 place-items-center rounded-full bg-accent text-accent-foreground">
                  {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </span>
              </button>
              <Link
                to="/offres"
                className="inline-flex items-center justify-center rounded-full bg-white px-6 py-4 text-sm font-semibold text-primary transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-primary"
              >
                Voir les offres du jour
              </Link>
            </div>
          </div>
        </div>
      </Reveal>
    </section>
  );
}