import { useEffect,useState } from "react";
import { createFileRoute,Link } from "@tanstack/react-router";
import { getAccessToken } from "../lib/auth-client";
import { getMyOrders } from "../lib/commerce";
export const Route=createFileRoute("/commandes")({component:OrdersPage});
const money=new Intl.NumberFormat("fr-HT",{style:"currency",currency:"HTG"});
function OrdersPage(){
 const [orders,setOrders]=useState([]),[notice,setNotice]=useState("Chargement…");
 useEffect(()=>{(async()=>{try{const token=await getAccessToken();setOrders(await getMyOrders({data:{token}}));setNotice("");}catch(e){setNotice(e.message);}})();},[]);
 return <main className="commerce-page">
  <header className="commerce-header"><Link to="/">← Accueil</Link><strong className="commerce-brand"><img src="/images/lama-market-logo.svg" alt="" aria-hidden="true"/>Mes commandes</strong><Link to="/panier">Mon panier</Link><Link to="/compte">Mon compte</Link></header>
  <div className="commerce-container">
   <div className="commerce-title"><span>HISTORIQUE</span><h1>Mes commandes</h1><p>Suivez les étapes de traitement, les paiements et les livraisons de vos achats.</p></div>
   {notice&&<div className="commerce-panel" role="status">{notice} <Link to="/auth">Se connecter</Link></div>}
   {orders.map(o=><article className="commerce-panel order-card" key={o.id}>
    <div className="order-head"><strong>{o.order_number}</strong><span>{new Date(o.created_at).toLocaleDateString("fr-FR")}</span></div>
    <div className="order-meta"><span>Commande : {o.status}</span><span>Paiement : {o.payment_status}</span><span>Livraison : {o.delivery_status}</span></div>
    <div className="order-address">
     <strong>Adresse de livraison</strong>
     <p>{o.address_snapshot?.recipientName} · {o.address_snapshot?.phone}</p>
     <p>{o.address_snapshot?.addressLine}, {o.address_snapshot?.area} {o.address_snapshot?.city}</p>
     {o.address_snapshot?.landmark&&<small>Repère : {o.address_snapshot.landmark}</small>}
    </div>
    <div className="order-lines">{o.items.map((item,i)=><div className="table-line" key={i}><span>{item.quantity} × {item.name}<small>{item.sku||"Référence non renseignée"}</small></span><strong>{money.format(Number(item.lineTotal??Number(item.price)*item.quantity))}</strong></div>)}</div>
    <div className="order-totals">
     <div className="cart-total"><span>Sous-total</span><strong>{money.format(Number(o.subtotal))}</strong></div>
     <div className="cart-total"><span>Remise</span><strong>− {money.format(Number(o.discount_total||0))}</strong></div>
     <div className="cart-total"><span>Livraison</span><strong>{money.format(Number(o.delivery_fee))}</strong></div>
     <div className="cart-total"><strong>Total payé / à payer</strong><strong>{money.format(Number(o.total))}</strong></div>
    </div>
    {o.customer_note&&<p>Votre note : {o.customer_note}</p>}
    <h3>Suivi de la commande</h3>
    <ol className="order-history">{o.history.map((step,i)=><li key={i}><strong>{step.status}</strong><span>{new Date(step.createdAt).toLocaleString("fr-FR")}</span>{step.note&&<small>{step.note}</small>}</li>)}</ol>
   </article>)}
   {!notice&&!orders.length&&<div className="commerce-panel">Vous n'avez pas encore passé de commande.</div>}
  </div>
 </main>;
}
