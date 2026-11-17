import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { User, Heart, Package } from "lucide-react";

export default function AccountDialog({ children }) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Mon compte"
        className="grid h-10 w-10 place-items-center rounded-full text-foreground/70 transition-colors hover:bg-secondary hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      >
        {children ?? <User className="h-5 w-5" strokeWidth={1.9} />}
      </button>
      <DialogContent className="max-w-md rounded-[28px]">
        <DialogHeader>
          <DialogTitle className="font-heading text-2xl font-extrabold text-primary">
            Votre espace Lama
          </DialogTitle>
          <DialogDescription className="text-[15px] leading-relaxed text-muted-foreground">
            La création de compte arrive très bientôt : vous pourrez suivre vos commandes, garder
            vos favoris et retrouver votre panier sur tous vos appareils. En attendant, votre panier
            est déjà enregistré sur cet appareil.
          </DialogDescription>
        </DialogHeader>
        <ul className="mt-2 grid gap-3 text-sm text-foreground/75">
          <li className="flex items-center gap-3">
            <Heart className="h-4 w-4 text-accent" /> Vos favoris restent accessibles sans compte
          </li>
          <li className="flex items-center gap-3">
            <Package className="h-4 w-4 text-accent" /> Suivi de commande par e-mail dès le départ
          </li>
        </ul>
      </DialogContent>
    </Dialog>
  );
}
