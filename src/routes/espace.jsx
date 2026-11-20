import { useEffect, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { getAccessToken } from "../lib/auth-client";
import { getMyAccessContext } from "../lib/commerce";

export const Route = createFileRoute("/espace")({ component: WorkspaceRedirect });

function WorkspaceRedirect() {
  const navigate = useNavigate();
  const [message, setMessage] = useState("Identification de votre espace…");
  const [requiresApproval, setRequiresApproval] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const token = await getAccessToken();
        const access = await getMyAccessContext({ data: { token } });
        if (!active) return;
        if (access.primaryRole === "customer") {
          setRequiresApproval(true);
          setMessage("Votre compte client est actif. Pour rejoindre l'équipe Lama Market comme administrateur ou responsable, l'administrateur principal doit vérifier votre compte et vous attribuer un rôle.");
          return;
        }
        await navigate({ to: access.destination, replace: true });
      } catch (error) {
        if (active) setMessage(error.message || "Connexion requise.");
      }
    })();
    return () => { active = false; };
  }, [navigate]);

  return <main className="commerce-page"><div className="commerce-container"><section className="commerce-panel workspace-redirect">
    <span className="section-kicker">LAMA MARKET</span>
    <h1>{requiresApproval ? "Accès professionnel à valider" : "Votre espace de travail"}</h1>
    <p>{message}</p>
    {requiresApproval
      ? <Link className="account-submit inline-submit" to="/compte">Consulter mon compte</Link>
      : <Link className="account-submit inline-submit" to="/auth">Se connecter ou créer un compte</Link>}
    <p><Link to="/">Retour à la boutique</Link></p>
  </section></div></main>;
}
