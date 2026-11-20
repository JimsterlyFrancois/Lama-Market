import { useEffect, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { authClient } from "../lib/auth-client";

export const Route = createFileRoute("/auth")({ component: AuthPage });

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState("signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!authClient) return;
    authClient.getSession().then(({ data }) => {
      if (data?.user) navigate({ to: "/espace" });
    }).catch(() => {});
  }, [navigate]);

  function switchMode(next) { setMode(next); setMessage(""); }

  async function submit(event) {
    event.preventDefault();
    setMessage("");
    if (!authClient) { setMessage("L'authentification Neon n'est pas encore configurée."); return; }
    setPending(true);
    try {
      if (mode === "forgot") {
        const result = await authClient.requestPasswordReset({
          email: email.trim(),
          redirectTo: window.location.origin + "/reinitialiser",
        });
        if (result.error) throw new Error(result.error.message || "Demande de réinitialisation impossible.");
        setMessage("Si cette adresse correspond à un compte, un lien de réinitialisation lui sera envoyé.");
        return;
      }
      const result = mode === "signup"
        ? await authClient.signUp.email({
            name: name.trim(), email: email.trim(), password,
            callbackURL: window.location.origin + "/auth?verification=complete",
          })
        : await authClient.signIn.email({ email: email.trim(), password });
      if (result.error) throw new Error(result.error.message || "Authentification impossible.");
      if (result.data?.user) navigate({ to: "/espace" });
      else setMessage("Compte créé. Vérifiez votre boîte e-mail pour confirmer votre adresse avant de vous connecter.");
    } catch (error) {
      setMessage(error.message || "Une erreur est survenue.");
    } finally { setPending(false); }
  }

  async function resendVerification() {
    if (!authClient || !email.trim()) { setMessage("Saisissez votre adresse e-mail."); return; }
    setPending(true); setMessage("");
    try {
      const result = await authClient.sendVerificationEmail({
        email: email.trim(),
        callbackURL: window.location.origin + "/auth?verification=complete",
      });
      if (result.error) throw new Error(result.error.message || "Envoi impossible.");
      setMessage("Une nouvelle demande de vérification a été envoyée si le compte existe.");
    } catch (error) {
      setMessage(error.message || "Le service d'e-mail de vérification n'est pas disponible.");
    } finally { setPending(false); }
  }

  return (
    <main className="account-page">
      <section className="account-card">
        <Link to="/" className="back-link">← Retour à Lama Market</Link>
        <div className="account-brand">Lama <strong>Market</strong></div>
        <h1>{mode === "signup" ? "Créer votre compte" : mode === "forgot" ? "Réinitialiser le mot de passe" : "Connexion"}</h1>
        <p>Accédez à votre panier, vos commandes et votre suivi de livraison.</p>
        <div className="auth-switch">
          <button type="button" className={mode === "signin" ? "selected" : ""} onClick={() => switchMode("signin")}>Se connecter</button>
          <button type="button" className={mode === "signup" ? "selected" : ""} onClick={() => switchMode("signup")}>Créer un compte</button>
        </div>
        <form onSubmit={submit} className="account-form">
          {mode === "signup" && <label>Nom complet<input value={name} onChange={e=>setName(e.target.value)} autoComplete="name" required /></label>}
          <label>Adresse e-mail<input type="email" value={email} onChange={e=>setEmail(e.target.value)} autoComplete="email" required /></label>
          {mode !== "forgot" && <label>Mot de passe<input type="password" value={password} onChange={e=>setPassword(e.target.value)} autoComplete={mode==="signup"?"new-password":"current-password"} minLength={8} required /></label>}
          {message && <div className="form-message" role="alert">{message}</div>}
          <button className="account-submit" type="submit" disabled={pending}>{pending ? "Patientez..." : mode==="signup" ? "Créer mon compte" : mode==="forgot" ? "Envoyer le lien" : "Me connecter"}</button>
        </form>
        <div className="auth-secondary-actions">
          {mode === "signin" && <button type="button" className="text-button" onClick={()=>switchMode("forgot")}>Mot de passe oublié ?</button>}
          {mode === "signup" && <button type="button" className="text-button" disabled={pending} onClick={resendVerification}>Renvoyer l'e-mail de vérification</button>}
          {mode === "forgot" && <button type="button" className="text-button" onClick={()=>switchMode("signin")}>Retour à la connexion</button>}
        </div>
        <small>Vos informations sont protégées par Neon Auth.</small>
      </section>
    </main>
  );
}
