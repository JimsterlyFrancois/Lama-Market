import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { LayoutDashboard, LogOut, UserRound } from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { authClient, getAccessToken } from "@/lib/auth-client";
import { getMyAccessContext } from "@/lib/commerce";

export default function AccountMenu() {
  const [user, setUser] = useState(null);
  const [destination, setDestination] = useState("/compte");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        if (!authClient) return;
        const session = await authClient.getSession();
        const current = session?.data?.user;
        if (!active) return;
        setUser(current || null);
        if (current?.emailVerified) {
          try {
            const token = await getAccessToken();
            const access = await getMyAccessContext({ data: { token } });
            if (active) setDestination(access.destination || "/compte");
          } catch { /* Keep the customer account destination. */ }
        }
      } catch {
        if (active) setUser(null);
      } finally {
        if (active) setLoading(false);
      }
    }
    load();
    return () => { active = false; };
  }, []);

  const trigger = (
    <button type="button" aria-label="Ouvrir l'espace personnel" title="Espace personnel et professionnel"
      className="grid h-11 w-11 place-items-center rounded-full border border-border bg-card text-foreground shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
      <UserRound className="h-5 w-5" strokeWidth={1.9} aria-hidden="true" />
    </button>
  );

  if (loading || !user) {
    return <Link to={user ? "/auth" : "/espace"} aria-label="Espace professionnel" title="Espace professionnel"
      className="grid h-11 w-11 place-items-center rounded-full border border-border bg-card text-foreground shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
      <UserRound className="h-5 w-5" strokeWidth={1.9} aria-hidden="true" />
    </Link>;
  }

  async function logout() {
    await authClient?.signOut();
    setUser(null);
    window.location.assign("/");
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>{trigger}</DropdownMenuTrigger>
      <DropdownMenuContent align="end" side="top" className="w-60">
        <DropdownMenuLabel className="truncate">{user.name || user.email}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link to="/compte">Mon compte</Link>
        </DropdownMenuItem>
        {destination !== "/compte" && (
          <DropdownMenuItem asChild>
            <Link to={destination}><LayoutDashboard className="mr-2 h-4 w-4" /> Espace professionnel</Link>
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={logout}>
          <LogOut className="mr-2 h-4 w-4" /> Se déconnecter
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
