import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { LayoutDashboard, LogOut, UserRound } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/lib/AuthContext";
import { getMyAccess } from "@/lib/staff-fns";

export default function AccountMenu() {
  const { user, isAuthenticated, isLoadingAuth, logout } = useAuth();
  const [level, setLevel] = useState(null);

  useEffect(() => {
    if (!isAuthenticated) {
      setLevel(null);
      return;
    }
    getMyAccess().then((a) => setLevel(a.level));
  }, [isAuthenticated]);

  const trigger = (
    <button
      type="button"
      aria-label="Espace professionnel" title="Espace professionnel"
      className="grid h-10 w-10 place-items-center rounded-full text-foreground/70 transition-colors hover:bg-secondary hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
    >
      <UserRound className="h-5 w-5" strokeWidth={1.9} aria-hidden="true" />
    </button>
  );

  if (isLoadingAuth || !isAuthenticated) {
    return (
      <button
        type="button"
        onClick={() => navigateToLogin()}
        aria-label="Se connecter"
        className="grid h-10 w-10 place-items-center rounded-full text-foreground/70 transition-colors hover:bg-secondary hover:text-primary"
      >
        <img src="/images/lama-market-logo.svg" alt="" aria-hidden="true" className="h-7 w-7 object-contain" />
      </button>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>{trigger}</DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="truncate">{user?.full_name || user?.email}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {level && (
          <DropdownMenuItem asChild>
            <Link to="/equipe">
              <LayoutDashboard className="mr-2 h-4 w-4" /> Espace équipe
            </Link>
          </DropdownMenuItem>
        )}
        <DropdownMenuItem onClick={() => logout()}>
          <LogOut className="mr-2 h-4 w-4" /> Se déconnecter
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
