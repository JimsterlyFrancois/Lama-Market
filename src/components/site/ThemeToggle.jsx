import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { Moon, Sun } from "lucide-react";

export default function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const dark = mounted && resolvedTheme === "dark";

  return (
    <button
      type="button"
      onClick={() => setTheme(dark ? "light" : "dark")}
      aria-label={dark ? "Passer en mode clair" : "Passer en mode sombre"}
      className="grid h-10 w-10 place-items-center rounded-full text-foreground/70 transition-colors hover:bg-secondary hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
    >
      {dark ? <Sun className="h-5 w-5" strokeWidth={1.9} /> : <Moon className="h-5 w-5" strokeWidth={1.9} />}
    </button>
  );
}