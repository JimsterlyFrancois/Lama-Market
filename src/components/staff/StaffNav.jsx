import { Link } from "@tanstack/react-router";

const TABS = [
  { to: "/equipe", label: "Tableau de bord", exact: true },
  { to: "/equipe/commandes", label: "Commandes" },
  { to: "/equipe/produits", label: "Produits" },
  { to: "/equipe/personnel", label: "Équipe", admin: true },
];

export default function StaffNav({ access }) {
  const isAdmin = access.level !== "vendeur";
  return (
    <nav className="mt-5 flex gap-1 overflow-x-auto border-b border-border pb-3">
      {TABS.filter((t) => !t.admin || isAdmin).map((t) => (
        <Link
          key={t.to}
          to={t.to}
          activeOptions={{ exact: Boolean(t.exact) }}
          activeProps={{ className: "bg-primary text-primary-foreground" }}
          inactiveProps={{ className: "text-foreground/70 hover:bg-secondary" }}
          className="flex-none rounded-full px-4 py-2 text-[13px] font-semibold transition-colors"
        >
          {t.label}
        </Link>
      ))}
    </nav>
  );
}