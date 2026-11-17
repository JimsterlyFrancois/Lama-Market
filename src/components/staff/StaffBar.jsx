import { useCallback, useEffect, useState } from "react";
import { Megaphone, Siren, Eye } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { listNotes, markNoteSeen, postNote } from "@/lib/staff-fns";
import { cn } from "@/lib/utils";

export default function StaffBar({ access }) {
  const [notes, setNotes] = useState([]);

  const refresh = useCallback(() => listNotes().then(setNotes), []);
  useEffect(() => {
    refresh();
    const timer = setInterval(refresh, 15000);
    return () => clearInterval(timer);
  }, [refresh]);

  const lastMessage = notes.find((n) => n.kind === "message");
  const alerts = notes.filter((n) => n.kind === "alert" && !n.seen);

  const see = async (id) => {
    await markNoteSeen({ data: { id } });
    refresh();
  };

  const sendAlert = async () => {
    await postNote({ data: { kind: "alert", content: "Besoin d'aide, merci de venir." } });
    toast.success("Alerte Secours envoyée à toute l'équipe");
    refresh();
  };

  return (
    <div className="flex flex-col gap-3">
      {alerts.map((a) => (
        <div
          key={a.id}
          className="flex animate-pulse items-center gap-3 rounded-2xl bg-destructive px-4 py-3 text-destructive-foreground"
        >
          <Siren className="h-5 w-5 flex-none" />
          <p className="min-w-0 flex-1 text-sm font-semibold">
            Secours {a.author_emoji} {a.author_code} — {a.content}
          </p>
          <Button size="sm" variant="secondary" onClick={() => see(a.id)}>
            <Eye className="mr-1 h-4 w-4" /> Voir
          </Button>
        </div>
      ))}
      <div className="flex flex-wrap items-center gap-3">
        <div
          className={cn(
            "flex min-w-0 flex-1 items-center gap-2 rounded-2xl border border-border bg-card px-4 py-2.5 text-sm",
            !lastMessage && "text-muted-foreground"
          )}
        >
          <Megaphone className="h-4 w-4 flex-none text-accent" />
          <span className="truncate">
            {lastMessage ? `Message de l'administration : ${lastMessage.content}` : "Aucun message de l'administration"}
          </span>
        </div>
        <Button variant="destructive" size="sm" onClick={sendAlert}>
          <Siren className="mr-1 h-4 w-4" /> Secours
        </Button>
      </div>
    </div>
  );
}