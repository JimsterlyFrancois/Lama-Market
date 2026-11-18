import { useEffect,useState } from "react";
import { createFileRoute,Link } from "@tanstack/react-router";
import { getAccessToken } from "../lib/auth-client";
import { getMyOrders } from "../lib/commerce";
export const Route=createFileRoute("/commandes")({component:OrdersPage});
const money=new Intl.NumberFormat("fr-HT",{style:"currency",currency:"HTG"});
function OrdersPage(){const [orders,setOrders]=useState([]);const [notice,setNotice]=useState("Chargement…");
useEffect(()=>{(async()=>{try{const token=await getAccessToken();const rows=await getMyOrders({data:{token}});setOrders(rows);setNotice("");}catch(e){setNotice(e.message);}})();},[]);
return <main className="commerce-page"><header className="commerce-header"><Link to="/">← Accueil</Link><strong>Mes commandes</strong><Link to="/compte">Mon compte</Link></header><div className="commerce-container"><div className="commerce-title"><span>HISTORIQUE</span><h1>Mes commandes</h1><p>Consultez l'état de vos achats et de vos livraisons.</p></div>{notice&&<div className="commerce-panel">{notice} <Link to="/auth">Se connecter</Link></div>}{orders.map(o=><article className="commerce-panel order-card" key={o.id}><div className="order-head"><strong>{o.order_number}</strong><span>{new Date(o.created_at).toLocaleDateString("fr-FR")}</span></div><div className="order-meta"><span>Commande : {o.status}</span><span>Paiement : {o.payment_status}</span><span>Livraison : {o.delivery_status}</span></div>{o.items.map((it,i)=><p key={i}>{it.quantity} × {it.name} — {money.format(Number(it.price)*it.quantity)}</p>)}<strong>Total : {money.format(Number(o.total))}</strong></article>)}{!notice&&!orders.length&&<div className="commerce-panel">Vous n'avez pas encore passé de commande.</div>}</div></main>;
}
