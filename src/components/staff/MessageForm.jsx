import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { postNote } from "@/lib/staff-fns";

export default function MessageForm() {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    if (!text.trim()) return;
    setBusy(true);
    try {
      await postNote({ data: { kind: "message", content: text.trim() } });
      setText("");
      toast.success("Message envoyé aux vendeurs");
    } catch (error) {
      toast.error(error.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="flex gap-2">
      <Input value={text} onChange={(e) => setText(e.target.value)} maxLength={400} placeholder="Message aux vendeurs…" />
      <Button type="submit" disabled={busy}>Envoyer</Button>
    </form>
  );
}