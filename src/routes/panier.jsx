import { useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { getAccessToken } from "../lib/auth-client";
import { getMyCart, updateCartItem, removeCartItem, checkout } from "../lib/commerce";

export const Route = createFileRoute("/panier")({ component: CartPage });
const money = new Intl.NumberFormat("fr-HT",{style:"currency",currency:"HTG"});
function CartPage(){
  const navigate=useNavigate();
  const idempotencyKey=useRef(crypto.randomUUID());
  const [items,setItems]=useState([]);
  const [loading,setLoading]=useState(true);
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState("");
  const [address,setAddress]=useState({recipientName:"",phone:"",addressLine:"",city:"Cap-Haïtien",area:"",landmark:"",instructions:""});
  const total=useMemo(()=>items.reduce((sum,item)=>sum+Number(item.price)*item.quantity,0),[items]);
  async function load(){
    setLoading(true);setMessage("");
    try{const token=await getAccessToken();setItems(await getMyCart({data:{token}}));}
    catch(e){setMessage(e.message||"Connectez-vous pour consulter votre panier.");}
    finally{setLoading(false);}
  }
  useEffect(()=>{load();},[]);
  async function quantity(item,value){
    try{const token=await getAccessToken();await updateCartItem({data:{token,itemId:item.id,quantity:Number(value)}});await load();}
    catch(e){setMessage(e.message);}
  }
  async function remove(item){
    const token=await getAccessToken();await removeCartItem({data:{token,itemId:item.id}});await load();
  }
  async function order(event){
    event.preventDefault();setBusy(true);setMessage("");
    try{
      const token=await getAccessToken();
      const result=await checkout({data:{token,address,paymentMethod:"cash_on_delivery",idempotencyKey:idempotencyKey.current}});
      navigate({to:"/commandes",search:{newOrder:result.orderNumber}});
    }catch(e){setMessage(e.message||"Impossible de valider la commande.");}
    finally{setBusy(false);}
  }
  return <main className="commerce-page">
    <header className="commerce-header"><Link to="/" className="back-link">← Continuer les achats</Link><strong className="commerce-brand"><img src="/images/lama-market-logo.svg" alt="" aria-hidden="true" />Lama Market</strong></header>
    <div className="commerce-container">
      <div className="commerce-title"><span>VOTRE SÉLECTION</span><h1>Mon panier</h1><p>Vérifiez les articles avant de confirmer votre commande.</p></div>
      {loading?<div className="commerce-panel">Chargement du panier…</div>:message && !items.length?<div className="commerce-panel"><p>{message}</p><Link to="/auth" className="account-submit inline-submit">Se connecter</Link></div>:!items.length?<div className="commerce-panel"><h2>Votre panier est vide</h2><Link to="/" className="account-submit inline-submit">Découvrir les produits</Link></div>:<>
        <div className="cart-layout">
          <section className="commerce-panel cart-items">
            {items.map(item=><article className="cart-item" key={item.id}>
              {item.image_url?<img src={item.image_url} alt={item.name}/>:<div className="cart-placeholder">LM</div>}
              <div className="cart-item-main"><strong>{item.name}</strong><span>{money.format(Number(item.price))}</span><small>{item.stock} disponible(s)</small></div>
              <input aria-label={"Quantité de "+item.name} type="number" min="1" max={item.stock} value={item.quantity} onChange={e=>quantity(item,e.target.value)}/>
              <button className="text-button" onClick={()=>remove(item)}>Retirer</button>
            </article>)}
          </section>
          <section className="commerce-panel checkout-panel">
            <h2>Livraison et paiement</h2>
            <form className="account-form" onSubmit={order}>
              <label>Nom du destinataire<input required value={address.recipientName} onChange={e=>setAddress({...address,recipientName:e.target.value})}/></label>
              <label>Téléphone<input required value={address.phone} onChange={e=>setAddress({...address,phone:e.target.value})}/></label>
              <label>Adresse complète<input required value={address.addressLine} onChange={e=>setAddress({...address,addressLine:e.target.value})}/></label>
              <label>Ville<input required value={address.city} onChange={e=>setAddress({...address,city:e.target.value})}/></label>
              <label>Quartier / zone<input value={address.area} onChange={e=>setAddress({...address,area:e.target.value})}/></label>
              <label>Repère (facultatif)<input value={address.landmark} onChange={e=>setAddress({...address,landmark:e.target.value})}/></label>
              <label>Instructions (facultatif)<textarea value={address.instructions} onChange={e=>setAddress({...address,instructions:e.target.value})}/></label>
              <div className="payment-choice"><strong>Paiement à la livraison</strong><span>Vous réglez votre commande au livreur lors de la réception.</span></div>
              <div className="cart-total"><span>Sous-total estimé</span><strong>{money.format(total)}</strong></div>
              <small>Les frais de livraison seront calculés selon la zone configurée par Lama Market.</small>
              {message&&<div className="form-message" role="alert">{message}</div>}
              <button className="account-submit" disabled={busy}>{busy?"Validation…":"Confirmer la commande"}</button>
            </form>
          </section>
        </div>
      </>}
    </div>
  </main>;
}
