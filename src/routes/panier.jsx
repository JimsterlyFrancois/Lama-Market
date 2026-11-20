import { useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { getAccessToken } from "../lib/auth-client";
import { getMyCart, getMyAddresses, getCheckoutQuote, getPaymentOptions, startOrderPayment, updateCartItem, removeCartItem, checkout } from "../lib/commerce";

export const Route = createFileRoute("/panier")({ component: CartPage });
const money = new Intl.NumberFormat("fr-HT",{style:"currency",currency:"HTG"});
function CartPage(){
  const navigate=useNavigate();
  const idempotencyKey=useRef(crypto.randomUUID());
  const [items,setItems]=useState([]);
  const [addresses,setAddresses]=useState([]);
  const [addressId,setAddressId]=useState("");
  const [addressInitialized,setAddressInitialized]=useState(false);
  const [couponCode,setCouponCode]=useState("");
  const [quote,setQuote]=useState(null);
  const [quoteMessage,setQuoteMessage]=useState("");
  const [paymentOptions,setPaymentOptions]=useState({cash_on_delivery:true,moncash:false,natcash:false,provider:null});
  const [paymentMethod,setPaymentMethod]=useState("cash_on_delivery");
  const [loading,setLoading]=useState(true);
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState("");
  const [address,setAddress]=useState({recipientName:"",phone:"",addressLine:"",city:"Cap-Haïtien",area:"",landmark:"",instructions:""});
  const total=useMemo(()=>items.reduce((sum,item)=>sum+Number(item.price)*item.quantity,0),[items]);
  async function load(){
    setLoading(true);setMessage("");
    try{const token=await getAccessToken();const [cartRows,savedAddresses,methods]=await Promise.all([getMyCart({data:{token}}),getMyAddresses({data:{token}}),getPaymentOptions()]);setItems(cartRows);setAddresses(savedAddresses);setPaymentOptions(methods);const primary=savedAddresses.find(a=>a.is_default);if(primary&&!addressInitialized){setAddressId(primary.id);setAddress({recipientName:primary.recipient_name,phone:primary.phone,addressLine:primary.address_line,city:primary.city,area:primary.area||"",landmark:primary.landmark||"",instructions:primary.delivery_instructions||""});}setAddressInitialized(true);}
    catch(e){setMessage(e.message||"Connectez-vous pour consulter votre panier.");}
    finally{setLoading(false);}
  }
  useEffect(()=>{load();},[]);
  async function quantity(item,value){
    try{setQuote(null);const token=await getAccessToken();await updateCartItem({data:{token,itemId:item.id,quantity:Number(value)}});await load();}
    catch(e){setMessage(e.message);}
  }
  async function remove(item){
    setQuote(null);const token=await getAccessToken();await removeCartItem({data:{token,itemId:item.id}});await load();
  }
  function editAddress(field,value){setAddressId("");setAddress(current=>({...current,[field]:value}));setQuote(null);}
  function chooseAddress(id){
    setAddressId(id);setQuote(null);
    const selected=addresses.find(a=>a.id===id);
    if(selected)setAddress({recipientName:selected.recipient_name,phone:selected.phone,addressLine:selected.address_line,city:selected.city,area:selected.area||"",landmark:selected.landmark||"",instructions:selected.delivery_instructions||""});
    else setAddress({recipientName:"",phone:"",addressLine:"",city:"Cap-Haïtien",area:"",landmark:"",instructions:""});
  }
  async function calculateQuote(){
    setQuoteMessage("");setQuote(null);
    try{const token=await getAccessToken();const result=await getCheckoutQuote({data:{token,city:address.city,area:address.area,couponCode}});setQuote(result);}
    catch(e){setQuoteMessage(e.message||"Impossible de calculer le total.");}
  }
  async function order(event){
    event.preventDefault();setBusy(true);setMessage("");
    try{
      const token=await getAccessToken();
      const result=await checkout({data:{token,address,addressId:addressId||undefined,couponCode,paymentMethod,idempotencyKey:idempotencyKey.current}});
      if(result.paymentRequired){
        const payment=await startOrderPayment({data:{token,orderId:result.id}});
        if(payment.paymentUrl){window.location.assign(payment.paymentUrl);return;}
        window.location.assign("/paiement?orderId="+encodeURIComponent(result.id)+"&orderNumber="+encodeURIComponent(result.orderNumber));
        return;
      }
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
              <label>Adresse enregistrée<select value={addressId} onChange={e=>chooseAddress(e.target.value)}><option value="">Saisir une nouvelle adresse</option>{addresses.map(a=><option key={a.id} value={a.id}>{a.recipient_name} · {a.address_line}, {a.city}{a.is_default?" · Par défaut":""}</option>)}</select></label>
              <label>Nom du destinataire<input required value={address.recipientName} onChange={e=>editAddress("recipientName",e.target.value)}/></label>
              <label>Téléphone<input required value={address.phone} onChange={e=>editAddress("phone",e.target.value)}/></label>
              <label>Adresse complète<input required value={address.addressLine} onChange={e=>editAddress("addressLine",e.target.value)}/></label>
              <label>Ville<input required value={address.city} onChange={e=>editAddress("city",e.target.value)}/></label>
              <label>Quartier / zone<input value={address.area} onChange={e=>editAddress("area",e.target.value)}/></label>
              <label>Repère (facultatif)<input value={address.landmark} onChange={e=>editAddress("landmark",e.target.value)}/></label>
              <label>Instructions (facultatif)<textarea value={address.instructions} onChange={e=>editAddress("instructions",e.target.value)}/></label>
              <fieldset className="payment-methods">
                <legend>Choisir un moyen de paiement</legend>
                <label className="payment-method-option"><input type="radio" name="paymentMethod" value="cash_on_delivery" checked={paymentMethod==="cash_on_delivery"} onChange={()=>setPaymentMethod("cash_on_delivery")}/><span><strong>Paiement à la livraison</strong><small>Réglez le livreur à la réception.</small></span></label>
                <label className={"payment-method-option "+(!paymentOptions.moncash?"is-disabled":"")}><input type="radio" name="paymentMethod" value="moncash" checked={paymentMethod==="moncash"} disabled={!paymentOptions.moncash} onChange={()=>setPaymentMethod("moncash")}/><span><strong>MonCash</strong><small>{paymentOptions.moncash?"Paiement sécurisé via la passerelle de paiement.":"En attente de l'activation du compte marchand."}</small></span></label>
                <label className={"payment-method-option "+(!paymentOptions.natcash?"is-disabled":"")}><input type="radio" name="paymentMethod" value="natcash" checked={paymentMethod==="natcash"} disabled={!paymentOptions.natcash} onChange={()=>setPaymentMethod("natcash")}/><span><strong>NatCash</strong><small>{paymentOptions.natcash?"Paiement sécurisé via la passerelle de paiement.":"En attente de l'activation du compte marchand."}</small></span></label>
                {!paymentOptions.moncash&&!paymentOptions.natcash&&<small className="payment-provider-note">MonCash et NatCash seront activés après l'ajout des clés API marchandes de test et du secret webhook.</small>}
              </fieldset>
              <label>Code promotionnel (facultatif)<input value={couponCode} onChange={e=>{setCouponCode(e.target.value.toUpperCase());setQuote(null);}} placeholder="Ex. LAMA10"/></label>
              <button type="button" className="text-button" onClick={calculateQuote}>Calculer la livraison et la remise</button>
              <div className="cart-total"><span>Sous-total</span><strong>{money.format(total)}</strong></div>
              {quote&&<><div className="cart-total"><span>Livraison</span><strong>{quote.deliveryFee===null?"Zone à vérifier":money.format(Number(quote.deliveryFee))}</strong></div><div className="cart-total"><span>Remise</span><strong>− {money.format(Number(quote.discount))}</strong></div><div className="cart-total"><span>Total estimé</span><strong>{quote.total===null?"—":money.format(Number(quote.total))}</strong></div></>}
              {quoteMessage&&<div className="form-message" role="alert">{quoteMessage}</div>}
              {!quote&&<small>Calculez le total avant confirmation. Le montant définitif est recalculé et vérifié côté serveur.</small>}
              {message&&<div className="form-message" role="alert">{message}</div>}
              <button className="account-submit" disabled={busy||!quote||quote.total===null}>{busy?"Validation…":"Confirmer la commande"}</button>
            </form>
          </section>
        </div>
      </>}
    </div>
  </main>;
}
