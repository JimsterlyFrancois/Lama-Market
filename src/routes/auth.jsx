import { useEffect,useState } from "react";
import { createFileRoute,Link,useNavigate } from "@tanstack/react-router";
import { authClient,emailOtp } from "../lib/auth-client";

export const Route=createFileRoute("/auth")({component:AuthPage});
const emailNotVerified=/email.*(not|isn.?t)\s*verified/i;

function AuthPage(){
 const navigate=useNavigate();
 const [mode,setMode]=useState("signin");
 const [name,setName]=useState(""),[email,setEmail]=useState(""),[password,setPassword]=useState("");
 const [otp,setOtp]=useState(""),[newPassword,setNewPassword]=useState(""),[confirm,setConfirm]=useState("");
 const [pending,setPending]=useState(false),[message,setMessage]=useState("");
 useEffect(()=>{
  if(!authClient)return;
  authClient.getSession().then(({data})=>{
   if(data?.user?.emailVerified)navigate({to:"/espace"});
  }).catch(()=>{});
 },[navigate]);
 function switchMode(next){setMode(next);setMessage("");setOtp("");}
 function errorMessage(result,fallback){if(result?.error)throw new Error(result.error.message||fallback);}
 async function submit(event){
  event.preventDefault();setMessage("");
  if(!authClient){setMessage("L'authentification Neon n'est pas configurée.");return;}
  setPending(true);
  try{
   if(mode==="signup"){
    const result=await authClient.signUp.email({name:name.trim(),email:email.trim(),password});
    errorMessage(result,"Création du compte impossible.");
    setMode("verify");setMessage("Un code de vérification à 6 chiffres a été envoyé à votre adresse e-mail.");
    return;
   }
   if(mode==="signin"){
    const result=await authClient.signIn.email({email:email.trim(),password});
    if(result.error){
     if(emailNotVerified.test(result.error.message||"")){
      const sent=await emailOtp.sendVerificationOtp(email.trim(),"email-verification");
      errorMessage(sent,"Impossible d'envoyer le code de vérification.");
      setMode("verify");setMessage("Votre adresse n'est pas encore vérifiée. Un nouveau code vous a été envoyé.");
      return;
     }
     throw new Error(result.error.message||"Connexion impossible.");
    }
    if(result.data?.user&&!result.data.user.emailVerified){
     await emailOtp.sendVerificationOtp(email.trim(),"email-verification");
     setMode("verify");setMessage("Vérifiez votre adresse avant d'accéder au compte.");
     return;
    }
    navigate({to:"/espace"});return;
   }
   if(mode==="forgot"){
    const result=await emailOtp.forgetPassword(email.trim());
    errorMessage(result,"Envoi du code de réinitialisation impossible.");
    setMode("reset");setMessage("Un code de réinitialisation a été envoyé. Saisissez-le ci-dessous.");
    return;
   }
   if(mode==="reset"){
    if(newPassword.length<8)throw new Error("Le nouveau mot de passe doit contenir au moins 8 caractères.");
    if(newPassword!==confirm)throw new Error("Les deux mots de passe ne correspondent pas.");
    const result=await emailOtp.resetPassword(email.trim(),otp.trim(),newPassword);
    errorMessage(result,"Code invalide ou réinitialisation impossible.");
    setPassword("");setNewPassword("");setConfirm("");setOtp("");
    setMode("signin");setMessage("Mot de passe modifié. Vous pouvez vous connecter.");
    return;
   }
   if(mode==="verify"){
    const result=await emailOtp.verifyEmail(email.trim(),otp.trim());
    errorMessage(result,"Code de vérification invalide ou expiré.");
    const session=await authClient.getSession();
    if(!session.data?.user&&password){
     const signed=await authClient.signIn.email({email:email.trim(),password});
     errorMessage(signed,"Adresse vérifiée. Connectez-vous avec votre mot de passe.");
    }
    navigate({to:"/espace"});
   }
  }catch(error){setMessage(error.message||"Une erreur est survenue.");}
  finally{setPending(false);}
 }
 async function resend(){
  setPending(true);setMessage("");
  try{
   const result=await emailOtp.sendVerificationOtp(email.trim(),"email-verification");
   errorMessage(result,"Envoi du code impossible.");
   setMessage("Un nouveau code a été envoyé.");
  }catch(error){setMessage(error.message||"Impossible de renvoyer le code.");}
  finally{setPending(false);}
 }
 const mainMode=["signin","signup"].includes(mode);
 return <main className="account-page"><section className="account-card">
  <Link to="/" className="back-link">← Retour à Lama Market</Link>
  <div className="account-brand">Lama <strong>Market</strong></div>
  <h1>{mode==="signup"?"Créer votre compte":mode==="verify"?"Vérifier votre adresse":mode==="forgot"?"Mot de passe oublié":mode==="reset"?"Nouveau mot de passe":"Connexion"}</h1>
  <p>{mode==="verify"?"Saisissez le code à 6 chiffres reçu par e-mail.":mode==="reset"?"Saisissez le code reçu et choisissez un nouveau mot de passe.":mode==="signup"?"Créez votre compte Lama Market. Pour accéder à l’espace professionnel, votre compte devra ensuite être validé et recevoir un rôle attribué par l’administrateur principal.":"Accédez à votre panier, vos commandes et votre suivi de livraison. Les accès administrateur et responsable sont attribués séparément après validation."}</p>
  {mainMode&&<div className="auth-switch">
   <button type="button" className={mode==="signin"?"selected":""} onClick={()=>switchMode("signin")}>Se connecter</button>
   <button type="button" className={mode==="signup"?"selected":""} onClick={()=>switchMode("signup")}>Créer un compte</button>
  </div>}
  <form onSubmit={submit} className="account-form">
   {mode==="signup"&&<label>Nom complet<input value={name} onChange={e=>setName(e.target.value)} autoComplete="name" required/></label>}
   <label>Adresse e-mail<input type="email" value={email} onChange={e=>setEmail(e.target.value)} autoComplete="email" required disabled={mode==="verify"||mode==="reset"}/></label>
   {["signin","signup"].includes(mode)&&<label>Mot de passe<input type="password" value={password} onChange={e=>setPassword(e.target.value)} autoComplete={mode==="signup"?"new-password":"current-password"} minLength={8} required/></label>}
   {["verify","reset"].includes(mode)&&<label>Code à 6 chiffres<input inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} value={otp} onChange={e=>setOtp(e.target.value.replace(/\D/g,"").slice(0,6))} required/></label>}
   {mode==="reset"&&<>
    <label>Nouveau mot de passe<input type="password" value={newPassword} onChange={e=>setNewPassword(e.target.value)} minLength={8} autoComplete="new-password" required/></label>
    <label>Confirmer le nouveau mot de passe<input type="password" value={confirm} onChange={e=>setConfirm(e.target.value)} minLength={8} autoComplete="new-password" required/></label>
   </>}
   {message&&<div className="form-message" role="status">{message}</div>}
   <button className="account-submit" type="submit" disabled={pending||(["verify","reset"].includes(mode)&&otp.length!==6)}>{pending?"Patientez...":mode==="signup"?"Créer mon compte":mode==="verify"?"Vérifier mon adresse":mode==="forgot"?"Envoyer un code":mode==="reset"?"Modifier le mot de passe":"Me connecter"}</button>
  </form>
  <div className="auth-secondary-actions">
   {mode==="signin"&&<button type="button" className="text-button" onClick={()=>switchMode("forgot")}>Mot de passe oublié ?</button>}
   {mode==="signup"&&<button type="button" className="text-button" disabled={pending} onClick={resend}>Renvoyer le code de vérification</button>}
   {mode==="verify"&&<><button type="button" className="text-button" disabled={pending} onClick={resend}>Renvoyer le code</button><button type="button" className="text-button" onClick={()=>switchMode("signin")}>Retour à la connexion</button></>}
   {["forgot","reset"].includes(mode)&&<button type="button" className="text-button" onClick={()=>switchMode("signin")}>Retour à la connexion</button>}
  </div>
  <small>Vérification par code e-mail via Neon Auth.</small>
 </section></main>;
}
