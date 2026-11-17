import { Link } from "@tanstack/react-router";
import { ArrowUpRight } from "lucide-react";
import { Image } from "@/components/ui/image";
import { CATEGORIES } from "@/lib/catalog";
import Reveal from "@/components/site/Reveal";

export default function CategoryGrid() {
  return (
    <section className="mx-auto w-full max-w-[1280px] px-5 py-16 sm:px-8 sm:py-24">
      <Reveal className="mb-10 flex flex-wrap items-end justify-between gap-4 sm:mb-14">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-accent">
            Explorer
          </p>
          <h2 className="mt-3 max-w-xl font-heading text-3xl font-extrabold leading-[1.05] tracking-tight text-primary sm:text-[2.75rem]">
            Nos catégories populaires
          </h2>
        </div>
        <Link
          to="/boutique"
          className="group inline-flex items-center gap-2 text-sm font-semibold text-primary transition-colors hover:text-accent"
        >
          Tout le catalogue
          <ArrowUpRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
        </Link>
      </Reveal>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 sm:gap-5 lg:grid-cols-6">
        {CATEGORIES.map((category, index) => (
          <Reveal key={category.slug} delay={index * 60}>
            <Link
              to="/boutique"
              search={{ categorie: category.slug }}
              className="group flex h-full flex-col items-center gap-4 rounded-[28px] px-3 py-6 text-center transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] hover:-translate-y-1 hover:shadow-[0_20px_45px_-30px_rgba(6,78,59,0.5)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
              style={{ backgroundColor: category.tint }}
            >
              <span className="overflow-hidden rounded-full ring-1 ring-black/5">
                <Image
                  src={category.image_url}
                  alt={category.label}
                  className="h-20 w-20 object-cover transition-transform duration-700 ease-out group-hover:scale-110 sm:h-24 sm:w-24"
                />
              </span>
              <span className="flex flex-col gap-1">
                <span className="font-heading text-[15px] font-bold text-foreground">
                  {category.label}
                </span>
                <span className="text-[11px] leading-snug text-muted-foreground">
                  {category.blurb}
                </span>
              </span>
            </Link>
          </Reveal>
        ))}
      </div>
    </section>
  );
}
