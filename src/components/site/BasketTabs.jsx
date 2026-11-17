import { useCart, BASKET_COLORS, MAX_BASKETS } from "@/lib/cart";
import { cn } from "@/lib/utils";
import BasketDialog from "@/components/site/BasketDialog";

export default function BasketTabs({ className }) {
  const { baskets, activeId, setActiveBasket } = useCart();

  return (
    <div className={cn("flex items-center gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden", className)}>
      <span className="mr-1 hidden flex-none text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground sm:block">
        Paniers {baskets.length}/{MAX_BASKETS}
      </span>
      {baskets.map((basket) => {
        const palette = BASKET_COLORS[basket.color] ?? BASKET_COLORS.emeraude;
        const quantity = (basket.items ?? []).reduce((sum, item) => sum + item.quantity, 0);
        const active = basket.id === activeId;
        return (
          <button
            key={basket.id}
            type="button"
            onClick={() => setActiveBasket(basket.id)}
            aria-pressed={active}
            className={cn(
              "flex flex-none items-center gap-1.5 rounded-full border px-3.5 py-2 text-[13px] font-semibold transition-colors",
              active ? `${palette.chip} ${palette.ring}` : "border-border bg-card text-foreground/70 hover:border-primary/40 hover:text-primary"
            )}
          >
            <span aria-hidden="true">{basket.emoji}</span>
            <span className="max-w-[130px] truncate">{basket.title}</span>
            {quantity > 0 && <span className="opacity-70">· {quantity}</span>}
          </button>
        );
      })}
      <BasketDialog />
    </div>
  );
}
