import { useState } from "react";
import { useRouter } from "@tanstack/react-router";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { createManualOrder } from "@/lib/staff-fns";

export default function NewOrderDialog({ products }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [qty, setQty] = useState({});

  const submit = async (event) => {
    event.preventDefault();
    const items = Object.entries(qty)
      .filter(([, q]) => q > 0)
      .map(([product_id, quantity]) => ({ product_id, quantity }));
    if (!name.trim() || items.length === 0) return toast.error("Indiquez un nom et au moins un produit");
    try {
      await createManualOrder({ data: { customer_name: name.trim(), items } });
      toast.success("Commande ajoutée");
      setOpen(false);
      setName("");
      setQty({});
      router.invalidate();
    } catch (error) {
      toast.error(error.message);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="rounded-full"><Plus className="mr-1 h-4 w-4" /> Ajouter une commande</Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Nouvelle commande</DialogTitle></DialogHeader>
        <form onSubmit={submit} className="flex flex-col gap-3">
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nom de l'acheteur" maxLength={80} />
          <ul className="flex flex-col gap-2">
            {products.map((p) => (
              <li key={p.id} className="flex items-center gap-3 text-sm">
                <span className="min-w-0 flex-1 truncate">{p.name}</span>
                <Input
                  type="number"
                  min={0}
                  max={999}
                  value={qty[p.id] ?? ""}
                  onChange={(e) => setQty({ ...qty, [p.id]: Number(e.target.value) })}
                  className="w-20"
                  placeholder="0"
                />
              </li>
            ))}
          </ul>
          <Button type="submit">Enregistrer</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}