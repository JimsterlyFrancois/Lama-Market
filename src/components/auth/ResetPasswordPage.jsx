import { useEffect, useState } from "react";
import { AlertTriangle, Lock } from "lucide-react";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getSupabaseClient, isSupabaseConfigured } from "@/lib/supabase";

export function ResetPasswordPage() {
  const [hasRecoverySession, setHasRecoverySession] = useState(false);
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setReady(true);
      return undefined;
    }
    const client = getSupabaseClient();
    let active = true;
    client.auth.getSession().then(({ data }) => {
      if (active) {
        setHasRecoverySession(Boolean(data.session));
        setReady(true);
      }
    });
    const { data: listener } = client.auth.onAuthStateChange((event, session) => {
      if (active && (event === "PASSWORD_RECOVERY" || session)) setHasRecoverySession(Boolean(session));
    });
    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, []);

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
    setBusy(true);
    try {
      const { error: updateError } = await getSupabaseClient().auth.updateUser({ password });
      if (updateError) throw updateError;
      window.location.replace("/login?password=updated");
    } catch (updateError) {
      setError(updateError?.message || "Impossible de modifier le mot de passe. Demandez un nouveau lien.");
      setBusy(false);
    }
  }

  return (
    <AuthLayout icon={Lock} title="Nouveau mot de passe" subtitle="Choisissez un mot de passe sécurisé">
      {!ready ? <p className="text-center text-sm text-muted-foreground">Vérification du lien…</p> : !hasRecoverySession ? (
        <div className="space-y-4 text-center">
          <AlertTriangle className="mx-auto h-8 w-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Le lien de réinitialisation est absent ou expiré. Demandez-en un nouveau.</p>
          <a href="/forgot-password" className="inline-flex h-11 w-full items-center justify-center rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground">Demander un nouveau lien</a>
        </div>
      ) : (
        <>
          {error && <p role="alert" className="mb-4 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="new-password">Nouveau mot de passe</Label>
              <Input id="new-password" type="password" autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} minLength={8} className="h-12" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-password">Confirmer le mot de passe</Label>
              <Input id="confirm-password" type="password" autoComplete="new-password" value={confirm} onChange={(event) => setConfirm(event.target.value)} minLength={8} className="h-12" required />
            </div>
            <button type="submit" disabled={busy} className="h-12 w-full rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-60">
              {busy ? "Mise à jour…" : "Modifier le mot de passe"}
            </button>
          </form>
        </>
      )}
    </AuthLayout>
  );
}
