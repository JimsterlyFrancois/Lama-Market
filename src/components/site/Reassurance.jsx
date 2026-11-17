import { Truck, ShieldCheck, Headphones, RotateCcw } from "lucide-react";
import Reveal from "@/components/site/Reveal";

const ITEMS = [
  {
    icon: Truck,
    title: "Livraison rapide & suivie",
    text: "Expédié en 24 h, livré chez vous en 2 à 3 jours.",
  },
  {
    icon: ShieldCheck,
    title: "Paiement 100 % sécurisé",
    text: "Transactions chiffrées et données protégées.",
  },
  {
    icon: Headphones,
    title: "Service client 7j/7",
    text: "Une vraie personne vous répond en moins de 2 h.",
  },
  {
    icon: RotateCcw,
    title: "Satisfait ou remboursé",
    text: "30 jours pour changer d'avis, sans justification.",
  },
];

export default function Reassurance() {
  return (
    <section className="border-y border-black/5 bg-card">
      <div className="mx-auto grid w-full max-w-[1280px] grid-cols-1 gap-px px-5 sm:grid-cols-2 sm:px-8 lg:grid-cols-4">
        {ITEMS.map((item, index) => {
          const Icon = item.icon;
          return (
            <Reveal
              key={item.title}
              delay={index * 70}
              className="flex items-start gap-4 border-b border-black/5 py-7 last:border-b-0 sm:border-b-0 sm:py-9 sm:pr-6 lg:border-l lg:border-black/5 lg:pl-6 lg:first:border-l-0 lg:first:pl-0"
            >
              <span className="grid h-11 w-11 flex-none place-items-center rounded-2xl bg-secondary text-primary">
                <Icon className="h-5 w-5" strokeWidth={2.1} />
              </span>
              <span className="flex flex-col gap-1">
                <span className="font-heading text-[15px] font-bold leading-snug text-foreground">
                  {item.title}
                </span>
                <span className="text-[13px] leading-relaxed text-muted-foreground">
                  {item.text}
                </span>
              </span>
            </Reveal>
          );
        })}
      </div>
    </section>
  );
}