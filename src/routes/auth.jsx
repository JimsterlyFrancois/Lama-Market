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

  async function submit(event) {
    event.preventDefault();
    setMessage("");
    if (!authClient) { setMessage("L'authentification Neon n'est pas encore configurée."); return; }
    setPending(true);
    try {
      const result = mode === "signup"
        ? await authClient.signUp.email({ name: name.trim(), email: email.trim(), password })
        : await authClient.signIn.email({ email: email.trim(), password });
      if (result.error) throw new Error(result.error.message || "Authentification impossible.");
      if (result.data?.user) navigate({ to: "/espace" });
      else setMessage("Vérifiez votre boîte e-mail pour poursuivre.");
    } catch (error) {
      setMessage(error.message || "Une erreur est survenue.");
    } finally { setPending(false); }
  }

  return (
    <main className="account-page">
      <section className="account-card">
        <Link to="/" className="back-link">← Retour à Lama Market</Link>
        <div className="account-brand">Lama <strong>Market</strong></div>
        <h1>{mode === "signup" ? "Créer votre compte" : "Connexion"}</h1>
        <p>Accédez à votre panier, vos commandes et votre suivi de livraison.</p>
        <div className="auth-switch">
          <button className={mode === "signin" ? "selected" : ""} onClick={() => {setMode("signin");setMessage("");}}>Se connecter</button>
          <button className={mode === "signup" ? "selected" : ""} onClick={() => {setMode("signup");setMessage("");}}>Créer un compte</button>
        </div>
        <form onSubmit={submit} className="account-form">
          {mode === "signup" && <label>Nom complet<input value={name} onChange={e=>setName(e.target.value)} autoComplete="name" required /></label>}
          <label>Adresse e-mail<input type="email" value={email} onChange={e=>setEmail(e.target.value)} autoComplete="email" required /></label>
          <label>Mot de passe<input type="password" value={password} onChange={e=>setPassword(e.target.value)} autoComplete={mode==="signup"?"new-password":"current-password"} minLength={8} required /></label>
          {message && <div className="form-message" role="alert">{message}</div>}
          <button className="account-submit" type="submit" disabled={pending}>{pending ? "Patientez..." : mode==="signup" ? "Créer mon compte" : "Me connecter"}</button>
        </form>
        <small>Vos informations sont protégées par Neon Auth.</small>
      </section>
    </main>
  );
}
