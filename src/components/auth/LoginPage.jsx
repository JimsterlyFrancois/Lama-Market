import { useState } from "react";
import { Lock, LogIn, Mail } from "lucide-react";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getSupabaseClient, isSupabaseConfigured } from "@/lib/supabase";

function getSafeReturnTo() {
  const value = new URLSearchParams(window.location.search).get("returnTo");
  if (!value) return "/";
  try {
    const target = new URL(value, window.location.origin);
    return target.origin === window.location.origin
      ? target.pathname + target.search + target.hash
      : "/";
  } catch {
    return "/";
  }
}

export function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setError("");
    if (!isSupabaseConfigured) {
      setError("Le service de connexion n'est pas encore configuré.");
      return;
    }
    setBusy(true);
    try {
      const { error: authError } = await getSupabaseClient().auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (authError) throw authError;
      window.location.replace(getSafeReturnTo());
    } catch (authError) {
      setError(authError?.message || "Connexion impossible. Vérifiez vos identifiants.");
      setBusy(false);
    }
  }

  return (
    <AuthLayout icon={LogIn} title="Connexion" subtitle="Accédez à votre espace Lama Market">
      {error && <p role="alert" className="mb-4 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}
      <form onSubmit={submit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="login-email">Adresse e-mail</Label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <Input id="login-email" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} className="h-12 pl-10" required />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="login-password">Mot de passe</Label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <Input id="login-password" type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} className="h-12 pl-10" required />
          </div>
        </div>
        <button type="submit" disabled={busy} className="h-12 w-full rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-60">
          {busy ? "Connexion…" : "Se connecter"}
        </button>
      </form>
      <div className="mt-5 flex justify-between text-sm">
        <a href="/forgot-password" className="font-medium text-primary hover:underline">Mot de passe oublié ?</a>
        <a href="/register" className="font-medium text-primary hover:underline">Créer un compte</a>
      </div>
    </AuthLayout>
  );
}
