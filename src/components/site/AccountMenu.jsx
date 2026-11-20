import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { LayoutDashboard, LogOut, UserRound } from "lucide-react";
import { authClient, getAccessToken } from "../../lib/auth-client";
import { getMyAccessContext } from "../../lib/commerce";

const ROLE_LABELS = {
  admin: "ADM",
  courier: "Livreur",
  customer: "Acheteur",
  fulfillment: "Équipe",
};

export default function AccountMenu() {
  const [user, setUser] = useState(null);
  const [destination, setDestination] = useState("/compte");
  const [roleLabel, setRoleLabel] = useState("");
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
        if (!current?.emailVerified) {
          setUser(null);
          return;
        }
        setUser(current);
        try {
          const token = await getAccessToken();
          const access = await getMyAccessContext({ data: { token } });
          if (!active) return;
          setDestination(access.destination || "/compte");
          const role = access.primaryRole || "customer";
          setRoleLabel(role === "customer" ? "Acheteur · Actif" : (ROLE_LABELS[role] || "Équipe"));
        } catch {
          if (active) setRoleLabel("Compte");
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

  const buttonClass = "grid h-11 w-11 place-items-center rounded-full border border-border bg-card text-foreground shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary";

  if (loading) {
    return <Link to="/compte" aria-label="Ouvrir mon compte" title="Mon compte" className={buttonClass}>
      <UserRound className="h-5 w-5" strokeWidth={1.9} aria-hidden="true" />
    </Link>;
  }

  if (!user) {
    return <Link to="/auth" aria-label="Se connecter ou créer un compte" title="Connexion / Inscription" className={buttonClass}>
      <UserRound className="h-5 w-5" strokeWidth={1.9} aria-hidden="true" />
    </Link>;
  }

  return (
    <div className="relative flex items-center gap-2">
      {roleLabel && <span className="rounded-full border border-border bg-card px-3 py-2 text-[11px] font-bold text-foreground shadow-sm">{roleLabel}</span>}
      <button type="button" onClick={() => setOpen(value => !value)}
        aria-label="Ouvrir l'espace personnel" aria-expanded={open}
        aria-haspopup="menu" title="Espace personnel et professionnel" className={buttonClass}>
        <UserRound className="h-5 w-5" strokeWidth={1.9} aria-hidden="true" />
      </button>
      {open && (
        <div role="menu" aria-label="Menu du compte" onKeyDown={event => { if (event.key === "Escape") setOpen(false); }}
          className="absolute bottom-14 right-0 z-[2100] w-60 rounded-2xl border border-border bg-card p-2 text-foreground shadow-2xl">
          <p className="truncate px-3 py-2 text-xs font-bold">{user.name || user.email}</p>
          {roleLabel && <p className="px-3 pb-2 text-xs text-primary">{roleLabel}</p>}
          <div className="my-1 border-t border-border" />
          <Link role="menuitem" to="/compte" onClick={() => setOpen(false)}
            className="block rounded-xl px-3 py-2.5 text-sm hover:bg-secondary">Paramètres et mon compte</Link>
          {destination !== "/compte" && (
            <Link role="menuitem" to={destination} onClick={() => setOpen(false)}
              className="flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm hover:bg-secondary">
              <LayoutDashboard className="h-4 w-4" /> Ouvrir mon espace {roleLabel}
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
