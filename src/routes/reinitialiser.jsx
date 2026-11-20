import { useEffect,useState } from "react";
import { createFileRoute,Link,useNavigate } from "@tanstack/react-router";
import { emailOtp } from "../lib/auth-client";
export const Route=createFileRoute("/reinitialiser")({component:ResetPasswordPage});
function ResetPasswordPage(){
 const navigate=useNavigate();
 const [email,setEmail]=useState("");
 const [otp,setOtp]=useState("");
 const [password,setPassword]=useState("");
 const [confirm,setConfirm]=useState("");
 const [message,setMessage]=useState("Saisissez l'adresse e-mail ayant reçu le code.");
 const [busy,setBusy]=useState(false);
 useEffect(()=>{const value=new URLSearchParams(window.location.search).get("email");if(value)setEmail(value);},[]);
 async function submit(event){
  event.preventDefault();setMessage("");
  if(!emailOtp){setMessage("Les fonctions de vérification Neon ne sont pas configurées.");return;}
  if(password.length<8){setMessage("Le mot de passe doit contenir au moins 8 caractères.");return;}
  if(password!==confirm){setMessage("Les deux mots de passe ne correspondent pas.");return;}
  setBusy(true);
  try{
   const result=await emailOtp.resetPassword(email.trim(),otp.trim(),password);
   if(result.error)throw new Error(result.error.message||"Code invalide ou expiré.");
   setMessage("Mot de passe modifié. Vous pouvez maintenant vous connecter.");
   setPassword("");setConfirm("");setOtp("");
   window.setTimeout(()=>navigate({to:"/auth"}),1200);
  }catch(error){setMessage(error.message||"Réinitialisation impossible.");}
  finally{setBusy(false);}
 }
 async function resend(){
  setBusy(true);setMessage("");
  try{const result=await emailOtp.forgetPassword(email.trim());if(result.error)throw new Error(result.error.message||"Envoi impossible.");setMessage("Un nouveau code a été envoyé.");}
  catch(error){setMessage(error.message||"Impossible d'envoyer le code.");}
  finally{setBusy(false);}
 }
 return <main className="account-page"><section className="account-card">
  <Link to="/auth" className="back-link">← Retour à la connexion</Link>
  <div className="account-brand">Lama <strong>Market</strong></div>
  <h1>Réinitialiser le mot de passe</h1>
  <p>Entrez le code à 6 chiffres reçu par e-mail et créez votre nouveau mot de passe.</p>
  <form className="account-form" onSubmit={submit}>
   <label>Adresse e-mail<input type="email" autoComplete="email" required value={email} onChange={e=>setEmail(e.target.value)}/></label>
   <label>Code reçu<input inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} required value={otp} onChange={e=>setOtp(e.target.value.replace(/\D/g,"").slice(0,6))}/></label>
   <label>Nouveau mot de passe<input type="password" autoComplete="new-password" minLength={8} required value={password} onChange={e=>setPassword(e.target.value)}/></label>
   <label>Confirmer le mot de passe<input type="password" autoComplete="new-password" minLength={8} required value={confirm} onChange={e=>setConfirm(e.target.value)}/></label>
   {message&&<div className="form-message" role="status">{message}</div>}
   <button className="account-submit" disabled={busy||otp.length!==6}>{busy?"Enregistrement...":"Enregistrer le nouveau mot de passe"}</button>
  </form>
  <button type="button" className="text-button" disabled={busy||!email.trim()} onClick={resend}>Renvoyer le code</button>
 </section></main>;
}
