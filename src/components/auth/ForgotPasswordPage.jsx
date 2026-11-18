import { useState } from "react";
import { ArrowLeft, Mail } from "lucide-react";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getSupabaseClient, isSupabaseConfigured } from "@/lib/supabase";

export function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  async function submit(event) {
    event.preventDefault();
    setError("");
    if (!isSupabaseConfigured) {
      setError("Le service de réinitialisation n'est pas encore configuré.");
      return;
    }
    setBusy(true);
    try {
      const { error: resetError } = await getSupabaseClient().auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (resetError) throw resetError;
      setSent(true);
    } catch {
      setError("La demande n'a pas pu être traitée. Vérifiez l'adresse et réessayez.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthLayout icon={Mail} title="Mot de passe oublié" subtitle="Recevez un lien de réinitialisation par e-mail">
      {sent ? (
        <p className="text-center text-sm text-foreground">Si un compte est associé à cette adresse, vous recevrez un lien pour choisir un nouveau mot de passe.</p>
      ) : (
        <>
          {error && <p role="alert" className="mb-4 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="forgot-email">Adresse e-mail</Label>
              <Input id="forgot-email" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} className="h-12" required />
            </div>
            <button type="submit" disabled={busy} className="h-12 w-full rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-60">
              {busy ? "Envoi…" : "Envoyer le lien"}
            </button>
          </form>
        </>
      )}
      <p className="mt-6 text-center text-sm"><a href="/login" className="font-medium text-primary hover:underline"><ArrowLeft className="mr-1 inline h-3 w-3" />Retour à la connexion</a></p>
    </AuthLayout>
  );
}
