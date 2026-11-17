import { useState } from "react";
import { useRouter } from "@tanstack/react-router";
import { Plus, Pencil } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { CATEGORY_OPTIONS } from "@/components/staff/status";
import { saveProduct } from "@/lib/staff-fns";

const num = (v) => (v === "" || v == null ? null : Number(v));

export default function ProductDialog({ product }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({
    name: product?.name ?? "",
    description: product?.description ?? "",
    category: product?.category ?? "epicerie",
    price: product?.price ?? "",
    old_price: product?.old_price ?? "",
    stock: product?.stock ?? "",
    discount_ends_at: product?.discount_ends_at?.slice(0, 16) ?? "",
    image_url: product?.image_url ?? "",
    is_active: product?.is_active !== false,
  });
  const set = (k) => (e) => setF({ ...f, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value });

  const submit = async (event) => {
    event.preventDefault();
    try {
      await saveProduct({
        data: {
          id: product?.id,
          name: f.name,
          description: f.description,
          category: f.category,
          price: Number(f.price),
          old_price: num(f.old_price),
          stock: num(f.stock),
          discount_ends_at: f.discount_ends_at ? new Date(f.discount_ends_at).toISOString() : null,
          image_url: f.image_url,
          is_active: f.is_active,
        },
      });
      toast.success("Produit enregistré");
      setOpen(false);
      router.invalidate();
    } catch (error) {
      toast.error(error.message);
    }
  };

  const field = (k, label, props = {}) => (
    <div className="flex flex-col gap-1">
      <Label htmlFor={`p-${k}`}>{label}</Label>
      <Input id={`p-${k}`} value={f[k]} onChange={set(k)} {...props} />
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {product ? (
          <Button size="icon" variant="ghost" aria-label="Modifier"><Pencil className="h-4 w-4" /></Button>
        ) : (
          <Button className="rounded-full"><Plus className="mr-1 h-4 w-4" /> Ajouter un produit</Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{product ? "Modifier le produit" : "Nouveau produit"}</DialogTitle></DialogHeader>
        <form onSubmit={submit} className="grid grid-cols-2 gap-3">
          <div className="col-span-2">{field("name", "Nom", { required: true, maxLength: 120 })}</div>
          <div className="col-span-2">{field("description", "Description", { maxLength: 600 })}</div>
          <div className="col-span-2 flex flex-col gap-1">
            <Label htmlFor="p-category">Catégorie</Label>
            <select id="p-category" value={f.category} onChange={set("category")} className="h-9 rounded-md border border-input bg-background px-3 text-sm">
              {CATEGORY_OPTIONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
          {field("price", "Prix", { type: "number", step: "0.01", min: 0, required: true })}
          {field("old_price", "Ancien prix (offre)", { type: "number", step: "0.01", min: 0 })}
          {field("stock", "Stock", { type: "number", min: 0 })}
          {field("discount_ends_at", "Fin de l'offre", { type: "datetime-local" })}
          <div className="col-span-2">{field("image_url", "Image (URL)", { maxLength: 500 })}</div>
          <label className="col-span-2 flex items-center gap-2 text-sm">
            <input type="checkbox" checked={f.is_active} onChange={set("is_active")} /> Visible dans la boutique
          </label>
          <Button type="submit" className="col-span-2">Enregistrer</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}