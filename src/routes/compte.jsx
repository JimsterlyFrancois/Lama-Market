import { useEffect,useState } from "react";
import { createFileRoute,Link } from "@tanstack/react-router";
import { authClient,getAccessToken } from "../lib/auth-client";
import { getMyProfile,updateMyProfile,getMyNotifications,getMyAddresses,saveMyAddress,deleteMyAddress,getMyNotificationPreferences,updateMyNotificationPreferences,getMyAccessContext } from "../lib/commerce";
export const Route=createFileRoute("/compte")({component:ProfilePage});
const emptyAddress={recipientName:"",phone:"",addressLine:"",department:"",city:"Cap-Haïtien",area:"",landmark:"",instructions:"",isDefault:false};
function ProfilePage(){
 const [profile,setProfile]=useState({phone:"",preferred_name:""}),[email,setEmail]=useState("");
 const [notice,setNotice]=useState(""),[notifications,setNotifications]=useState([]),[addresses,setAddresses]=useState([]);
 const [address,setAddress]=useState(emptyAddress),[editingAddressId,setEditingAddressId]=useState("");
 const [busy,setBusy]=useState(false),[access,setAccess]=useState(null);
 const [preferences,setPreferences]=useState({email_enabled:true,sms_enabled:false});
 async function load(){
  try{
   const token=await getAccessToken();
   const [p,n,a,prefs,role]=await Promise.all([getMyProfile({data:{token}}),getMyNotifications({data:{token}}),getMyAddresses({data:{token}}),getMyNotificationPreferences({data:{token}}),getMyAccessContext({data:{token}}).catch(()=>null)]);
   setProfile(p.profile||{phone:"",preferred_name:""});setEmail(p.user.email||"");setNotifications(n);setAddresses(a);setPreferences(prefs);setAccess(role);setNotice("");
  }catch(e){setNotice(e.message);}
 }
 useEffect(()=>{load();},[]);
 async function save(e){e.preventDefault();setBusy(true);try{const token=await getAccessToken();await updateMyProfile({data:{token,phone:profile.phone,preferredName:profile.preferred_name}});setNotice("Profil enregistré.");}catch(e){setNotice(e.message);}finally{setBusy(false);}}
 async function saveAddress(e){
  e.preventDefault();setBusy(true);
  try{const token=await getAccessToken();await saveMyAddress({data:{token,...address,addressId:editingAddressId||undefined}});setAddress(emptyAddress);setEditingAddressId("");await load();setNotice("Adresse de livraison enregistrée.");}
  catch(e){setNotice(e.message);}finally{setBusy(false);}
 }
 function editAddress(a){
  setEditingAddressId(a.id);
  setAddress({recipientName:a.recipient_name,phone:a.phone,addressLine:a.address_line,department:a.department||"",city:a.city,area:a.area||"",landmark:a.landmark||"",instructions:a.delivery_instructions||"",isDefault:a.is_default});
 }
 async function removeAddress(id){
  if(!window.confirm("Supprimer cette adresse de livraison ?"))return;
  setBusy(true);try{const token=await getAccessToken();await deleteMyAddress({data:{token,addressId:id}});await load();setNotice("Adresse supprimée.");}catch(e){setNotice(e.message);}finally{setBusy(false);}
 }
 async function savePreferences(next){
  setPreferences(next);setBusy(true);
  try{const token=await getAccessToken();const saved=await updateMyNotificationPreferences({data:{token,emailEnabled:next.email_enabled}});setPreferences(saved);setNotice("Préférences de notification enregistrées.");}
  catch(e){setNotice(e.message||"Impossible d'enregistrer les préférences.");}
  finally{setBusy(false);}
 }
 async function logout(){await authClient?.signOut();window.location.href="/";}
 return <main className="commerce-page">
  <header className="commerce-header"><Link to="/">← Accueil</Link><strong className="commerce-brand"><img src="/images/lama-market-logo.svg" alt="" aria-hidden="true"/>Mon compte</strong><button className="text-button" onClick={logout}>Déconnexion</button></header>
  <div className="commerce-container">
   <div className="commerce-title"><span>ESPACE PERSONNEL</span><h1>Mon profil</h1><p>Gérez vos coordonnées, vos adresses et vos préférences.</p><span className="cover-current-label">{access?.primaryRole==="admin"?"ADM":access?.primaryRole==="courier"?"Livreur":access?.primaryRole==="customer"?"Acheteur · Actif":access?.primaryRole?"Équipe":"Compte"}</span></div>
   {notice&&<div className="form-message" role="status">{notice}</div>}
   <div className="profile-grid">
    <section className="commerce-panel"><h2>Mes coordonnées</h2><form className="account-form" onSubmit={save}>
     <label>Adresse e-mail<input value={email} disabled/></label>
     <label>Nom affiché<input value={profile.preferred_name||""} onChange={e=>setProfile({...profile,preferred_name:e.target.value})}/></label>
     <label>Téléphone<input value={profile.phone||""} onChange={e=>setProfile({...profile,phone:e.target.value})}/></label>
     <button className="account-submit" disabled={busy}>Enregistrer le profil</button>
    </form></section>
    <section className="commerce-panel"><h2>Mes adresses enregistrées</h2>
     {addresses.map(a=><article className="address-card" key={a.id}>
      <div><strong>{a.recipient_name}</strong>{a.is_default&&<span className="cover-current-label">Adresse par défaut</span>}
       <p>{a.phone}</p><p>{a.address_line}, {a.area||""} {a.city}</p>{a.landmark&&<small>Repère : {a.landmark}</small>}
      </div>
      <div className="address-actions"><button type="button" className="text-button" disabled={busy} onClick={()=>editAddress(a)}>Modifier</button><button type="button" className="text-button" disabled={busy} onClick={()=>removeAddress(a.id)}>Supprimer</button></div>
     </article>)}
     {!addresses.length&&<p className="muted-note">Aucune adresse enregistrée. Ajoutez une adresse pour accélérer vos prochaines commandes.</p>}
    </section>
   </div>
   <section className="commerce-panel">
    <h2>{editingAddressId?"Modifier une adresse":"Ajouter une adresse de livraison"}</h2>
    <form className="account-form" onSubmit={saveAddress}>
     <div className="form-two">
      <label>Nom du destinataire<input required value={address.recipientName} onChange={e=>setAddress({...address,recipientName:e.target.value})}/></label>
      <label>Téléphone<input required value={address.phone} onChange={e=>setAddress({...address,phone:e.target.value})}/></label>
     </div>
     <label>Adresse complète<input required value={address.addressLine} onChange={e=>setAddress({...address,addressLine:e.target.value})}/></label>
     <div className="form-two">
      <label>Département<input value={address.department} onChange={e=>setAddress({...address,department:e.target.value})}/></label>
      <label>Ville<input required value={address.city} onChange={e=>setAddress({...address,city:e.target.value})}/></label>
     </div>
     <div className="form-two">
      <label>Quartier / zone<input value={address.area} onChange={e=>setAddress({...address,area:e.target.value})}/></label>
      <label>Repère<input value={address.landmark} onChange={e=>setAddress({...address,landmark:e.target.value})}/></label>
     </div>
     <label>Instructions de livraison<textarea value={address.instructions} onChange={e=>setAddress({...address,instructions:e.target.value})}/></label>
     <label className="check-label"><input type="checkbox" checked={address.isDefault} onChange={e=>setAddress({...address,isDefault:e.target.checked})}/> Définir comme adresse par défaut</label>
     <div className="address-actions"><button className="account-submit" disabled={busy}>{editingAddressId?"Enregistrer les modifications":"Ajouter l'adresse"}</button>{editingAddressId&&<button type="button" className="text-button" onClick={()=>{setEditingAddressId("");setAddress(emptyAddress);}}>Annuler</button>}</div>
    </form>
   </section>
   <section className="commerce-panel">
    <h2>Préférences de notification</h2>
    <p className="muted-note">Choisissez les informations que Lama Market peut vous envoyer par e-mail. Les alertes importantes restent consultables dans votre compte.</p>
    <label className="notification-preference-row">
     <span><strong>Notifications par e-mail</strong><small>Commandes, paiements, préparation, livraison et remboursements.</small></span>
     <input type="checkbox" checked={preferences.email_enabled} disabled={busy} onChange={e=>savePreferences({...preferences,email_enabled:e.target.checked})}/>
    </label>
    <label className="notification-preference-row is-disabled">
     <span><strong>Notifications par SMS</strong><small>Disponible ultérieurement, après activation d'un fournisseur SMS.</small></span>
     <input type="checkbox" checked={false} disabled aria-label="Notifications SMS non disponibles"/>
    </label>
   </section>
   <section className="commerce-panel">
    <h2>Accès rapides</h2><p><Link to="/espace">Mon espace autorisé →</Link></p><p><Link to="/commandes">Mes commandes →</Link></p><p><Link to="/panier">Mon panier →</Link></p>
    <h3>Notifications récentes</h3>{notifications.slice(0,10).map(n=><div className="notification-row" key={n.id}><strong>{n.title}</strong><p>{n.message}</p><small>{new Date(n.created_at).toLocaleString("fr-FR")} · E-mail : {n.email_status||"non envoyé"}{n.email_error?" · "+n.email_error:""}</small></div>)}
   </section>
  </div>
 </main>;
}
