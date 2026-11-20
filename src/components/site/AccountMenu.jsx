import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { LayoutDashboard, LogOut, UserRound } from "lucide-react";
import { authClient, getAccessToken } from "../../lib/auth-client";
import { getMyAccessContext } from "../../lib/commerce";

export default function AccountMenu() {
  const [user, setUser] = useState(null);
  const [destination, setDestination] = useState("/compte");
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);

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

  async function logout() {
    await authClient?.signOut();
    setUser(null);
    setOpen(false);
    window.location.assign("/");
  }

  const trigger = (
    <button type="button" onClick={() => setOpen(value => !value)}
      aria-label="Ouvrir l'espace personnel" aria-expanded={open}
      aria-haspopup="menu" title="Espace personnel et professionnel"
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

  return (
    <div className="relative">
      {trigger}
      {open && (
        <div role="menu" aria-label="Menu du compte" onKeyDown={event => { if (event.key === "Escape") setOpen(false); }}
          className="absolute bottom-14 right-0 z-[2100] w-60 rounded-2xl border border-border bg-card p-2 text-foreground shadow-2xl">
          <p className="truncate px-3 py-2 text-xs font-bold">{user.name || user.email}</p>
          <div className="my-1 border-t border-border" />
          <Link role="menuitem" to="/compte" onClick={() => setOpen(false)}
            className="block rounded-xl px-3 py-2.5 text-sm hover:bg-secondary">Mon compte</Link>
          {destination !== "/compte" && (
            <Link role="menuitem" to={destination} onClick={() => setOpen(false)}
              className="flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm hover:bg-secondary">
              <LayoutDashboard className="h-4 w-4" /> Espace professionnel
            </Link>
          )}
          <div className="my-1 border-t border-border" />
          <button role="menuitem" type="button" onClick={logout}
            className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm hover:bg-secondary">
            <LogOut className="h-4 w-4" /> Se déconnecter
          </button>
        </div>
      )}
    </div>
  );
}
