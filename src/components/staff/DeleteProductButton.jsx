import { useRouter } from "@tanstack/react-router";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { removeProduct } from "@/lib/staff-fns";

export default function DeleteProductButton({ id, name }) {
  const router = useRouter();
  const remove = async () => {
    if (!window.confirm(`Supprimer « ${name} » ?`)) return;
    try {
      await removeProduct({ data: { id } });
      router.invalidate();
    } catch (error) {
      toast.error(error.message);
    }
  };
  return (
    <Button size="icon" variant="ghost" aria-label="Supprimer" onClick={remove}>
      <Trash2 className="h-4 w-4 text-destructive" />
    </Button>
  );
}