import { useEffect,useState } from "react";
import { createFileRoute,Link } from "@tanstack/react-router";
import { getAccessToken } from "../lib/auth-client";
import { getMyOrders } from "../lib/commerce";
export const Route=createFileRoute("/commandes")({component:OrdersPage});
const money=new Intl.NumberFormat("fr-HT",{style:"currency",currency:"HTG"});
function paymentLabel(method){return ({cash_on_delivery:"Paiement à la livraison",moncash:"MonCash",natcash:"NatCash"}[method]||method||"Paiement");}
function OrdersPage(){
 const [orders,setOrders]=useState([]),[notice,setNotice]=useState("Chargement…");
 async function load(){
  try{const token=await getAccessToken();setOrders(await getMyOrders({data:{token}}));setNotice("");}
  catch(e){setNotice(e.message||"Impossible de charger vos commandes.");}
 }
 useEffect(()=>{load();},[]);
 return <main className="commerce-page">
  <header className="commerce-header"><Link to="/">← Accueil</Link><strong className="commerce-brand"><img src="/images/lama-market-logo.svg" alt="" aria-hidden="true"/>Mes commandes</strong><Link to="/panier">Mon panier</Link><Link to="/compte">Mon compte</Link></header>
  <div className="commerce-container">
   <div className="commerce-title"><span>HISTORIQUE</span><h1>Mes commandes</h1><p>Suivez le traitement, les paiements, les remboursements et les livraisons de vos achats.</p></div>
   {notice&&<div className="commerce-panel" role="status">{notice} <Link to="/auth">Se connecter</Link></div>}
   {orders.map(o=><article className="commerce-panel order-card" key={o.id}>
    <div className="order-head"><strong>{o.order_number}</strong><span>{new Date(o.created_at).toLocaleDateString("fr-FR")}</span></div>
    <div className="order-meta"><span>Commande : {o.status}</span><span>Paiement : {o.payment_status}</span><span>Livraison : {o.delivery_status}</span></div>
    <div className="order-address"><strong>Adresse de livraison</strong><p>{o.address_snapshot?.recipientName} · {o.address_snapshot?.phone}</p><p>{o.address_snapshot?.addressLine}, {o.address_snapshot?.area} {o.address_snapshot?.city}</p>{o.address_snapshot?.landmark&&<small>Repère : {o.address_snapshot.landmark}</small>}</div>
    <div className="order-lines">{o.items.map((item,i)=><div className="table-line" key={i}><span>{item.quantity} × {item.name}<small>{item.sku||"Référence non renseignée"}</small></span><strong>{money.format(Number(item.lineTotal??Number(item.price)*item.quantity))}</strong></div>)}</div>
    <div className="order-totals">
     <div className="cart-total"><span>Sous-total</span><strong>{money.format(Number(o.subtotal))}</strong></div>
     <div className="cart-total"><span>Remise</span><strong>− {money.format(Number(o.discount_total||0))}</strong></div>
     <div className="cart-total"><span>Livraison</span><strong>{money.format(Number(o.delivery_fee))}</strong></div>
     <div className="cart-total"><strong>Total de la commande</strong><strong>{money.format(Number(o.total))}</strong></div>
    </div>
    <section className="order-payment-section">
     <h3>Paiement</h3>
     {(o.payments||[]).map((p,i)=><div className="payment-history-row" key={p.id||i}>
      <span><strong>{paymentLabel(p.method)}</strong><small>{p.provider||"Paiement direct"}{p.externalReference?" · Réf. "+p.externalReference:""}</small></span>
      <strong>{money.format(Number(p.amount))}</strong><span className={"payment-status status-"+p.status}>{p.status}</span>
      {p.paidAt&&<small>{new Date(p.paidAt).toLocaleString("fr-FR")}</small>}
     </div>)}
     {o.payment_status==="pending"&&(o.payments||[]).some(p=>["moncash","natcash"].includes(p.method))&&
      <Link className="account-submit inline-submit" to="/paiement" search={{orderId:o.id,orderNumber:o.order_number}}>Vérifier le paiement</Link>}
    </section>
    {(o.refunds||[]).length>0&&<section className="order-refunds"><h3>Remboursements</h3>{o.refunds.map(refund=><div className="payment-history-row" key={refund.id}>
      <span><strong>{money.format(Number(refund.amount))}</strong><small>{refund.reason}</small>{refund.externalReference&&<small>Référence : {refund.externalReference}</small>}</span>
      <span className={"payment-status status-"+refund.status}>{refund.status}</span>
      {refund.processedAt&&<small>{new Date(refund.processedAt).toLocaleDateString("fr-FR")}</small>}
     </div>)}
     <p className="muted-note">Les remboursements sont enregistrés dans votre historique avec leur statut et leur référence.</p>
    </section>}
    {o.customer_note&&<p>Votre note : {o.customer_note}</p>}
    <h3>Suivi de la commande</h3>
    <ol className="order-history">{o.history.map((step,i)=><li key={i}><strong>{step.status}</strong><span>{new Date(step.createdAt).toLocaleString("fr-FR")}</span>{step.note&&<small>{step.note}</small>}</li>)}</ol>
   </article>)}
   {!notice&&!orders.length&&<div className="commerce-panel">Vous n'avez pas encore passé de commande.</div>}
  </div>
 </main>;
}
