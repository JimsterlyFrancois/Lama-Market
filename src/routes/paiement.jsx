import { useEffect,useState } from "react";
import { createFileRoute,Link } from "@tanstack/react-router";
import { getAccessToken } from "../lib/auth-client";
import { refreshOrderPayment } from "../lib/commerce";

export const Route=createFileRoute("/paiement")({component:PaymentResultPage});

function PaymentResultPage(){
 const [orderId,setOrderId]=useState("");
 const [orderNumber,setOrderNumber]=useState("");
 const [status,setStatus]=useState("pending");
 const [message,setMessage]=useState("Vérification du paiement en cours…");
 const [busy,setBusy]=useState(false);
 async function refresh(){
  if(!orderId){setMessage("La référence de commande est absente.");return;}
  setBusy(true);
  try{
   const token=await getAccessToken();
   const result=await refreshOrderPayment({data:{token,orderId}});
   setStatus(result.status||"pending");
   setOrderNumber(result.orderNumber||orderNumber);
   setMessage(result.status==="completed"?"Paiement confirmé par le serveur.":result.status==="failed"?"Le paiement n'a pas été confirmé. La commande est annulée.":"Le paiement est encore en cours. Ne relancez pas une seconde transaction.");
  }catch(error){setMessage(error.message||"Impossible de vérifier le paiement.");}
  finally{setBusy(false);}
 }
 useEffect(()=>{
  const params=new URLSearchParams(window.location.search);
  const id=params.get("orderId")||"";
  setOrderId(id);setOrderNumber(params.get("orderNumber")||"");
  if(!id){setMessage("La référence de commande est absente.");return;}
  (async()=>{
   setBusy(true);
   try{
    const token=await getAccessToken();
    const result=await refreshOrderPayment({data:{token,orderId:id}});
    setStatus(result.status||"pending");setOrderNumber(result.orderNumber||"");
    setMessage(result.status==="completed"?"Paiement confirmé par le serveur.":result.status==="failed"?"Le paiement n'a pas été confirmé. La commande est annulée.":"Votre paiement est en attente de confirmation. Le retour du portefeuille ne suffit pas à confirmer la transaction.");
   }catch(error){setMessage(error.message||"Vérification impossible.");}
   finally{setBusy(false);}
  })();
 },[]);
 const paid=status==="completed"||status==="paid";
 const failed=status==="failed"||status==="cancelled";
 return <main className="account-page"><section className="account-card payment-result-card">
  <Link to="/" className="back-link">← Retour à la boutique</Link>
  <div className="account-brand">Lama <strong>Market</strong></div>
  <div className={"payment-state-icon "+(paid?"is-paid":failed?"is-failed":"is-pending")} aria-hidden="true">{paid?"✓":failed?"!":"…"}</div>
  <h1>{paid?"Paiement confirmé":failed?"Paiement non confirmé":"Vérification du paiement"}</h1>
  <p>{message}</p>
  {orderNumber&&<div className="payment-order-reference"><small>Commande</small><strong>{orderNumber}</strong></div>}
  {!paid&&!failed&&<button className="account-submit" type="button" disabled={busy||!orderId} onClick={refresh}>{busy?"Vérification…":"Vérifier à nouveau le paiement"}</button>}
  {paid&&<p className="payment-success-note">Votre commande est confirmée. Vous pouvez consulter son suivi et conserver votre référence.</p>}
  {failed&&<p className="payment-failure-note">Aucun second paiement n'a été lancé. Contactez l'administration en indiquant la référence de commande en cas de débit sur votre portefeuille.</p>}
  <div className="payment-result-links"><Link to="/commandes">Consulter mes commandes</Link><Link to="/">Continuer les achats</Link></div>
 </section></main>;
}
