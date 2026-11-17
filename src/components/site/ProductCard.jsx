import { Star, Plus, Heart } from "lucide-react";
import { Image } from "@/components/ui/image";
import { useCart, formatPrice } from "@/lib/cart";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export default function ProductCard({ product }) {
  const { addItem, toggleFavorite, isFavorite, activeBasket } = useCart();
  const favorite = isFavorite(product.id);
  const hasPromo = Boolean(product.old_price);

  const handleAdd = () => {
    addItem(product);
    toast.success(`${product.name.split("—")[0].trim()} ajouté au panier`, {
      description: `Ajouté à ${activeBasket.emoji} ${activeBasket.title}.`,
    });
  };

  return (
    <article className="group relative flex h-full flex-col overflow-hidden rounded-[28px] border border-black/5 bg-card shadow-[0_18px_45px_-28px_rgba(6,78,59,0.35)] transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] hover:-translate-y-1.5 hover:shadow-[0_28px_60px_-25px_rgba(6,78,59,0.35)] focus-within:ring-2 focus-within:ring-primary focus-within:ring-offset-2">
      <div className="relative overflow-hidden rounded-t-[28px] bg-secondary/60">
        <Image
          src={product.image_url}
          alt={product.name}
          className="aspect-[4/5] w-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.04]"
        />
        {product.badge && (
          <span
            className={cn(
              "absolute left-4 top-4 rounded-full px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.08em]",
              hasPromo ? "bg-accent text-accent-foreground" : "bg-primary text-primary-foreground"
            )}
          >
            {product.badge}
          </span>
        )}
        <button
          type="button"
          onClick={() => toggleFavorite(product.id)}
          aria-label={favorite ? "Retirer des favoris" : "Ajouter aux favoris"}
          aria-pressed={favorite}
          className={cn(
            "absolute right-4 top-4 grid h-9 w-9 place-items-center rounded-full bg-card/90 backdrop-blur transition-colors",
            favorite ? "text-accent" : "text-foreground/45 hover:text-primary"
          )}
        >
          <Heart className="h-4 w-4" fill={favorite ? "currentColor" : "none"} />
        </button>
      </div>

      <div className="flex flex-1 flex-col gap-3 p-5">
        <div className="flex items-center gap-1.5 text-[13px] text-muted-foreground">
          <Star className="h-3.5 w-3.5 fill-accent text-accent" />
          <span className="font-semibold text-foreground">
            {Number(product.rating ?? 0).toFixed(1)}/5
          </span>
          <span>({product.reviews ?? 0} avis)</span>
        </div>

        <h3 className="font-heading text-base font-bold leading-snug text-foreground">
          {product.name}
        </h3>

        <p className="line-clamp-2 text-[13px] leading-relaxed text-muted-foreground">
          {product.description}
        </p>

        <div className="mt-auto flex items-end justify-between gap-3 pt-1">
          <div className="flex flex-col">
            <span className="font-heading text-xl font-extrabold text-primary">
              {formatPrice(product.price)}
            </span>
            {hasPromo && (
              <span className="text-xs text-muted-foreground line-through">
                {formatPrice(product.old_price)}
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={handleAdd}
            className="inline-flex items-center gap-1.5 rounded-full bg-accent px-4 py-2.5 text-[13px] font-semibold text-accent-foreground transition-all duration-300 hover:bg-primary hover:text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 active:scale-95"
          >
            <Plus className="h-4 w-4" strokeWidth={2.6} />
            Ajouter
          </button>
        </div>
      </div>
    </article>
  );
}