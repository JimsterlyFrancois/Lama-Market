import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/AuthContext";
import { useCart } from "@/lib/cart";
import { placeOrder } from "@/lib/staff-fns";

export default function CheckoutButton() {
  const { isAuthenticated, navigateToLogin } = useAuth();
  const { items, clearCart } = useCart();
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!isAuthenticated) return navigateToLogin();
    setBusy(true);
    try {
      await placeOrder({ data: { items: items.map((i) => ({ id: i.id, quantity: i.quantity })) } });
      clearCart();
      toast.success("Commande envoyée", { description: "Le vendeur la validera à votre arrivée chez Lama." });
    } catch (error) {
      toast.error("Commande impossible", { description: error.message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-4 flex flex-col gap-2.5">
      <button
        type="button"
        onClick={submit}
        disabled={busy}
        className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-primary px-5 py-3.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-accent hover:text-accent-foreground disabled:opacity-60"
      >
        {busy && <Loader2 className="h-4 w-4 animate-spin" />}
        {isAuthenticated ? "Passer la commande" : "Se connecter pour commander"}
      </button>
      {!isAuthenticated && (
        <p className="text-center text-[12.5px] leading-relaxed text-muted-foreground">
          Un compte est nécessaire pour commander.{" "}
          <Link to="/register" className="font-semibold text-primary underline">
            Créer un compte
          </Link>
        </p>
      )}
    </div>
  );
}
