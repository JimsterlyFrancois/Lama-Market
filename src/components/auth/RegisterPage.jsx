import { useState } from "react";
import { Lock, Mail, UserPlus } from "lucide-react";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getSupabaseClient, isSupabaseConfigured } from "@/lib/supabase";

export function RegisterPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setError("");
    if (password.length < 8) {
      setError("Le mot de passe doit contenir au moins 8 caractères.");
      return;
    }
    if (password !== confirm) {
      setError("Les deux mots de passe ne correspondent pas.");
      return;
    }
    if (!isSupabaseConfigured) {
      setError("Le service d'inscription n'est pas encore configuré.");
      return;
    }
    setBusy(true);
    try {
      const { error: signUpError } = await getSupabaseClient().auth.signUp({
        email: email.trim(),
        password,
        options: { emailRedirectTo: `${window.location.origin}/login` },
      });
      if (signUpError) throw signUpError;
      setSent(true);
    } catch (signUpError) {
      setError(signUpError?.message || "Création du compte impossible pour le moment.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthLayout icon={UserPlus} title="Créer un compte" subtitle="Rejoignez Lama Market">
      {sent ? (
        <div className="space-y-4 text-center">
          <p className="text-sm text-foreground">Consultez votre boîte e-mail pour confirmer votre inscription. Vous pourrez ensuite vous connecter.</p>
          <a href="/login" className="inline-flex h-11 w-full items-center justify-center rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground">Aller à la connexion</a>
        </div>
      ) : (
        <>
          {error && <p role="alert" className="mb-4 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="register-email">Adresse e-mail</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                <Input id="register-email" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} className="h-12 pl-10" required />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="register-password">Mot de passe</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                <Input id="register-password" type="password" autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} className="h-12 pl-10" minLength={8} required />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="register-confirm">Confirmer le mot de passe</Label>
              <Input id="register-confirm" type="password" autoComplete="new-password" value={confirm} onChange={(event) => setConfirm(event.target.value)} className="h-12" minLength={8} required />
            </div>
            <button type="submit" disabled={busy} className="h-12 w-full rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-60">
              {busy ? "Création…" : "Créer mon compte"}
            </button>
          </form>
          <p className="mt-5 text-center text-sm text-muted-foreground">Vous avez déjà un compte ? <a href="/login" className="font-medium text-primary hover:underline">Se connecter</a></p>
        </>
      )}
    </AuthLayout>
  );
}
