import { useEffect,useState } from "react";
import { createFileRoute,Link,useNavigate } from "@tanstack/react-router";
import { authClient } from "../lib/auth-client";

export const Route=createFileRoute("/reinitialiser")({component:ResetPasswordPage});

function ResetPasswordPage(){
 const navigate=useNavigate();
 const [token,setToken]=useState("");
 const [password,setPassword]=useState("");
 const [confirm,setConfirm]=useState("");
 const [message,setMessage]=useState("Vérification du lien...");
 const [busy,setBusy]=useState(false);
 useEffect(()=>{
  const params=new URLSearchParams(window.location.search);
  const supplied=params.get("token");
  const error=params.get("error");
  setToken(supplied||"");
  setMessage(error?"Ce lien est invalide ou a expiré. Demandez-en un nouveau.":supplied?"":"Le lien de réinitialisation est incomplet.");
 },[]);
 async function submit(event){
  event.preventDefault();setMessage("");
  if(!authClient){setMessage("L'authentification Neon n'est pas configurée.");return;}
  if(!token){setMessage("Ce lien est invalide ou a expiré. Demandez-en un nouveau.");return;}
  if(password.length<8){setMessage("Le mot de passe doit contenir au moins 8 caractères.");return;}
  if(password!==confirm){setMessage("Les deux mots de passe ne correspondent pas.");return;}
  setBusy(true);
  try{
   const result=await authClient.resetPassword({newPassword:password,token});
   if(result.error)throw new Error(result.error.message||"La réinitialisation a échoué.");
   setMessage("Mot de passe modifié. Vous pouvez maintenant vous connecter.");
   setPassword("");setConfirm("");
   window.setTimeout(()=>navigate({to:"/auth"}),1200);
  }catch(error){setMessage(error.message||"Lien invalide ou expiré.");}
  finally{setBusy(false);}
 }
 return <main className="account-page"><section className="account-card">
  <Link to="/auth" className="back-link">← Retour à la connexion</Link>
  <div className="account-brand">Lama <strong>Market</strong></div>
  <h1>Nouveau mot de passe</h1>
  <p>Choisissez un mot de passe d'au moins 8 caractères.</p>
  <form className="account-form" onSubmit={submit}>
   <label>Nouveau mot de passe<input type="password" autoComplete="new-password" minLength={8} required value={password} onChange={e=>setPassword(e.target.value)} disabled={!token||busy}/></label>
   <label>Confirmer le mot de passe<input type="password" autoComplete="new-password" minLength={8} required value={confirm} onChange={e=>setConfirm(e.target.value)} disabled={!token||busy}/></label>
   {message&&<div className="form-message" role="status">{message}</div>}
   <button className="account-submit" disabled={!token||busy}>{busy?"Enregistrement...":"Enregistrer le nouveau mot de passe"}</button>
  </form>
 </section></main>;
}
