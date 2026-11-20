import { useEffect,useState } from "react";
import { createFileRoute,Link } from "@tanstack/react-router";
import { getAccessToken } from "../lib/auth-client";
import { getCourierDeliveries,courierUpdateDelivery,getDeliveryProofUploadUrl } from "../lib/commerce";
export const Route=createFileRoute("/livreur")({component:CourierPage});

function CourierPage(){
 const [rows,setRows]=useState([]),[message,setMessage]=useState("Chargement…"),[busy,setBusy]=useState("");
 async function load(){
  try{const token=await getAccessToken();setRows(await getCourierDeliveries({data:{token}}));setMessage("");}
  catch(e){setMessage(e.message||"Impossible de charger les livraisons.");}
 }
 useEffect(()=>{load();},[]);
 async function update(id,payload){
  setBusy(id);setMessage("");
  try{const token=await getAccessToken();await courierUpdateDelivery({data:{token,deliveryId:id,...payload}});await load();}
  catch(e){setMessage(e.message||"Mise à jour impossible.");}
  finally{setBusy("");}
 }
 return <main className="commerce-page">
  <header className="commerce-header"><Link to="/">← Boutique</Link><strong className="commerce-brand"><img src="/images/lama-market-logo.svg" alt="" aria-hidden="true"/>Espace livreur</strong><Link to="/compte">Mon compte</Link></header>
  <div className="commerce-container">
   <div className="commerce-title"><span>ÉQUIPE LAMA MARKET</span><h1>Mes livraisons</h1><p>Consultez les missions qui vous sont attribuées, les coordonnées du destinataire et les instructions de remise.</p></div>
   {message&&<div className="commerce-panel" role="status">{message}</div>}
   {rows.map(d=><Delivery key={d.id} item={d} busy={busy===d.id} onUpdate={update}/>)}
   {!message&&!rows.length&&<div className="commerce-panel">Aucune livraison ne vous est attribuée.</div>}
  </div>
 </main>;
}

function nextStatus(current){
 const next={assigned:"preparing",preparing:"in_transit",in_transit:"delivered",failed:"in_transit"};
 return next[current]||current;
}
function Delivery({item,busy,onUpdate}){
 const [status,setStatus]=useState(nextStatus(item.status));
 const [cash,setCash]=useState(false);
 const [proof,setProof]=useState(null);
 const [recipientName,setRecipientName]=useState(item.recipient_name||item.address_snapshot?.recipientName||"");
 const [failureReason,setFailureReason]=useState(item.failure_reason||"");
 const [note,setNote]=useState(item.courier_note||"");
 const [uploading,setUploading]=useState(false);
 const address=item.address_snapshot||{};
 useEffect(()=>{setStatus(nextStatus(item.status));},[item.status]);
 async function submit(){
  setUploading(true);
  try{
   let proofUrl=item.proof_url||"";
   if(proof){
    const token=await getAccessToken();
    const signed=await getDeliveryProofUploadUrl({data:{token,deliveryId:item.id,contentType:proof.type,size:proof.size}});
    const response=await fetch(signed.uploadUrl,{method:"PUT",headers:signed.headers,body:proof});
    if(!response.ok)throw new Error("L'envoi de la preuve de livraison a échoué.");
    proofUrl=signed.key;
   }
   await onUpdate(item.id,{status,cashCollected:cash,recipientName,failureReason,note,proofUrl});
   setProof(null);
  }catch(e){window.alert(e.message||"Impossible d'enregistrer la livraison.");}
  finally{setUploading(false);}
 }
 const terminal=["delivered","returned"].includes(item.status);
 return <article className="commerce-panel delivery-card">
  <div className="order-head"><strong>{item.order_number}</strong><span>{item.status}</span></div>
  <div className="delivery-recipient">
   <strong>{address.recipientName||item.recipient_name||"Destinataire"}</strong>
   {address.phone&&<a href={"tel:"+address.phone}>{address.phone}</a>}
   <p>{address.addressLine||"Adresse non renseignée"}</p>
   <p>{[address.area,address.city,address.department].filter(Boolean).join(" · ")}</p>
   {address.landmark&&<p>Repère : {address.landmark}</p>}
   {address.instructions&&<p>Instructions : {address.instructions}</p>}
   {item.customer_note&&<p>Note du client : {item.customer_note}</p>}
  </div>
  <div className="delivery-financial"><strong>Montant de la commande : {Number(item.total).toLocaleString("fr-HT")} HTG</strong><span>Frais de livraison : {Number(item.fee).toLocaleString("fr-HT")} HTG</span><span>Paiement : {item.payment_status}</span></div>
  {terminal?<p className="muted-note">Cette livraison est clôturée.</p>:<>
   <label className="inline-label">Étape de livraison<select value={status} onChange={e=>setStatus(e.target.value)}>
    {item.status==="assigned"&&<option value="preparing">En préparation</option>}
    {["assigned","preparing","failed"].includes(item.status)&&<option value="in_transit">En cours de livraison</option>}
    {["preparing","in_transit","failed"].includes(item.status)&&<option value="failed">Échec de livraison</option>}
    {item.status==="failed"&&<option value="returned">Retour à la boutique</option>}
    {["in_transit","preparing"].includes(item.status)&&<option value="delivered">Livrée</option>}
   </select></label>
   {status==="delivered"&&<label>Nom de la personne ayant reçu la commande<input value={recipientName} onChange={e=>setRecipientName(e.target.value)} placeholder="Nom du réceptionnaire"/></label>}
   {status==="failed"&&<label>Raison de l'échec<input required value={failureReason} onChange={e=>setFailureReason(e.target.value)} placeholder="Destinataire absent, adresse incorrecte..."/></label>}
   {(status==="failed"||status==="returned")&&<label>Note pour l'administration<textarea value={note} onChange={e=>setNote(e.target.value)} placeholder="Décrivez la situation"/></label>}
   {status==="delivered"&&<label>Preuve de remise (facultatif · JPG, PNG ou WebP · 5 Mo maximum)<input type="file" accept="image/jpeg,image/png,image/webp" onChange={e=>setProof(e.target.files?.[0]||null)}/></label>}
   {item.payment_status==="cash_due"&&status==="delivered"&&<label className="check-label"><input type="checkbox" checked={cash} onChange={e=>setCash(e.target.checked)}/> Paiement en espèces reçu</label>}
   <button className="account-submit" disabled={busy||uploading||(status==="delivered"&&item.payment_status==="cash_due"&&!cash)||(status==="failed"&&!failureReason.trim())||((status==="failed"||status==="returned")&&!note.trim())} onClick={submit}>{uploading?"Envoi de la preuve…":busy?"Enregistrement…":"Enregistrer la mise à jour"}</button>
  </>}
 </article>;
}
