import { useState } from "react";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useCart, BASKET_COLORS, BASKET_EMOJIS, MAX_BASKETS } from "@/lib/cart";
import { cn } from "@/lib/utils";

export default function BasketDialog({ basket }) {
  const { baskets, createBasket, updateBasket, removeBasket } = useCart();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState(basket?.title ?? "");
  const [emoji, setEmoji] = useState(basket?.emoji ?? BASKET_EMOJIS[0]);
  const [color, setColor] = useState(basket?.color ?? "emeraude");
  const full = baskets.length >= MAX_BASKETS;

  const submit = (event) => {
    event.preventDefault();
    const payload = { title: title.trim(), emoji, color };
    if (basket) updateBasket(basket.id, payload);
    else if (!createBasket(payload)) return;
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {basket ? (
          <Button type="button" size="icon" variant="ghost" aria-label={`Modifier ${basket.title}`}>
            <Pencil className="h-4 w-4" />
          </Button>
        ) : (
          <button
            type="button"
            disabled={full}
            className="flex flex-none items-center gap-1.5 rounded-full border border-dashed border-border px-3.5 py-2 text-[13px] font-semibold text-muted-foreground transition-colors hover:border-primary hover:text-primary disabled:opacity-50"
          >
            <Plus className="h-4 w-4" /> Panier
          </button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{basket ? "Modifier le panier" : "Nouveau panier"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="basket-title">Titre du panier</Label>
            <Input
              id="basket-title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              maxLength={24}
              placeholder="Courses de la semaine"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>Émoji</Label>
            <div className="flex flex-wrap gap-1.5">
              {BASKET_EMOJIS.map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setEmoji(value)}
                  aria-label={`Émoji ${value}`}
                  aria-pressed={emoji === value}
                  className={cn(
                    "grid h-10 w-10 place-items-center rounded-full border text-lg transition-colors",
                    emoji === value ? "border-primary bg-primary/10" : "border-border hover:border-primary/40"
                  )}
                >
                  {value}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>Couleur</Label>
            <div className="flex flex-wrap gap-2">
              {Object.entries(BASKET_COLORS).map(([key, palette]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setColor(key)}
                  aria-label={palette.label}
                  aria-pressed={color === key}
                  className={cn(
                    "grid h-8 w-8 place-items-center rounded-full border-2 transition-transform",
                    color === key ? "border-primary scale-110" : "border-transparent"
                  )}
                >
                  <span className={cn("h-5 w-5 rounded-full", palette.dot)} />
                </button>
              ))}
            </div>
          </div>

          <Button type="submit">{basket ? "Enregistrer" : "Créer le panier"}</Button>

          {basket && baskets.length > 1 && (
            <Button
              type="button"
              variant="ghost"
              className="text-destructive"
              onClick={() => {
                removeBasket(basket.id);
                setOpen(false);
              }}
            >
              <Trash2 className="mr-1.5 h-4 w-4" /> Supprimer ce panier
            </Button>
          )}
        </form>
      </DialogContent>
    </Dialog>
  );
}
