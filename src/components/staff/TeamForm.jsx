import { useState } from "react";
import { useRouter } from "@tanstack/react-router";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { addStaff } from "@/lib/staff-fns";

const EMOJIS = ["🙂", "🦊", "🐼", "🌟", "🍀", "🔥", "🌈", "🐯"];

export default function TeamForm({ isMaster }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [type, setType] = useState("vendeur");
  const [emoji, setEmoji] = useState("🙂");

  const submit = async (event) => {
    event.preventDefault();
    try {
      await addStaff({ data: { email, staff_type: type, emoji } });
      toast.success("Membre ajouté — il verra son espace après inscription");
      setEmail("");
      router.invalidate();
    } catch (error) {
      toast.error(error.message);
    }
  };

  return (
    <form onSubmit={submit} className="flex flex-wrap gap-2">
      <Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="E-mail du membre" className="min-w-[220px] flex-1" />
      {isMaster && (
        <select value={type} onChange={(e) => setType(e.target.value)} className="h-9 rounded-md border border-input bg-background px-3 text-sm">
          <option value="vendeur">Vendeur</option>
          <option value="adm">Administrateur</option>
        </select>
      )}
      <select value={emoji} onChange={(e) => setEmoji(e.target.value)} className="h-9 rounded-md border border-input bg-background px-3 text-sm" aria-label="Émoji">
        {EMOJIS.map((m) => <option key={m}>{m}</option>)}
      </select>
      <Button type="submit">Ajouter</Button>
    </form>
  );
}