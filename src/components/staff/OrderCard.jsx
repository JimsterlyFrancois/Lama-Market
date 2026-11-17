import { useRouter } from "@tanstack/react-router";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { STATUS } from "@/components/staff/status";
import { updateOrderStatus } from "@/lib/staff-fns";
import { formatPrice } from "@/lib/cart";

export default function OrderCard({ order, level }) {
  const router = useRouter();
  const isAdmin = level !== "vendeur";

  const setStatus = async (status) => {
    try {
      await updateOrderStatus({ data: { id: order.id, status } });
      router.invalidate();
    } catch (error) {
      toast.error(error.message);
    }
  };

  const actions = [];
  if (order.status === "pending") actions.push(["validated", "Valider"]);
  if (order.status === "validated") actions.push(["completed", "Marquer comme acheté"]);
  if (isAdmin && ["pending", "validated"].includes(order.status)) actions.push(["cancelled", "Annuler"]);

  return (
    <li className="rounded-[24px] border border-border bg-card p-5">
      <div className="flex flex-wrap items-center gap-3">
        <p className="font-heading text-base font-bold">{order.customer_name}</p>
        <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS[order.status].cls}`}>
          {STATUS[order.status].label}
        </span>
        <span className="ml-auto font-heading text-lg font-extrabold text-primary">{formatPrice(order.total)}</span>
      </div>
      <p className="mt-2 text-sm text-muted-foreground">
        {(order.items ?? []).map((i) => `${i.quantity}× ${i.name}`).join(" · ")}
      </p>
      {actions.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
          {actions.map(([status, label]) => (
            <Button key={status} size="sm" variant={status === "cancelled" ? "outline" : "default"} onClick={() => setStatus(status)}>
              {label}
            </Button>
          ))}
        </div>
      )}
    </li>
  );
}