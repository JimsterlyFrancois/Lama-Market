import { useEffect,useState } from "react";
import { createFileRoute,Link } from "@tanstack/react-router";
import { getAccessToken } from "../lib/auth-client";
import {
 getAdminDashboard,getAdminDeliveries,getAdminReports,adminCreateProduct,adminCreateDeliveryZone,adminListDeliveryZones,adminUpdateDeliveryZone,adminArchiveDeliveryZone,
 adminCreateCourier,adminAssignCourier,adminUpdateOrderStatus,adminAdjustStock,getProductImageUploadUrl,
 adminUpdateProduct,adminArchiveProduct,getStorefrontSettings,getCoverImageUploadUrl,saveStorefrontCover,
 adminListCategories,adminUpsertCategory,adminArchiveCategory,adminListCustomers,
 adminListStaff,adminAddStaff,adminUpdateStaff,
 adminListCoupons,adminUpsertCoupon,adminArchiveCoupon,adminAddProductImage,
 adminSetPrimaryProductImage,adminDeleteProductImage,adminGetProductStockHistory,
 adminReleaseExpiredReservations,adminListPayments,adminCreateRefund,adminUpdateRefund,
 getRefundProofUploadUrl,getRefundProofDownloadUrl,adminListNotifications,adminReconcilePendingPayments,
} from "../lib/commerce";
export const Route=createFileRoute("/admin")({component:AdminPage});
const money=new Intl.NumberFormat("fr-HT",{style:"currency",currency:"HTG"});
const emptyProduct={name:"",category:"",price:"",oldPrice:"",discountEndsAt:"",stock:"",lowStockThreshold:"5",description:"",imageUrl:"",imageKey:"",sku:"",isActive:true};
const emptyZone={name:"",department:"",city:"Cap-Haïtien",area:"",fee:"",freeFrom:"",minDays:"1",maxDays:"3",isActive:true};
const emptyCourier={email:"",displayName:"",phone:"",employmentType:"mandated"};
const emptyStaff={email:"",displayName:"",phone:"",staffRole:"fulfillment"};
const emptyCategory={name:"",slug:"",description:"",imageUrl:"",sortOrder:"0",isActive:true};
const emptyCoupon={code:"",discountType:"percent",discountValue:"10",minimumOrder:"0",maxUses:"",startsAt:"",endsAt:"",isActive:true};

function AdminPage(){
 const [data,setData]=useState(null),[deliveries,setDeliveries]=useState([]),[reports,setReports]=useState(null),[deliveryZones,setDeliveryZones]=useState([]),[editingZoneId,setEditingZoneId]=useState("");
 const [categories,setCategories]=useState([]),[customers,setCustomers]=useState([]),[coupons,setCoupons]=useState([]),[staff,setStaff]=useState([]);
 const [payments,setPayments]=useState([]),[adminNotifications,setAdminNotifications]=useState([]);
 const [reconcileResult,setReconcileResult]=useState(null);
 const [newStaff,setNewStaff]=useState(emptyStaff);
 const [message,setMessage]=useState("Chargement du tableau de bord…"),[busy,setBusy]=useState(false),[coverUrl,setCoverUrl]=useState("");
 const [product,setProduct]=useState(emptyProduct),[zone,setZone]=useState(emptyZone),[courier,setCourier]=useState(emptyCourier);
 const [category,setCategory]=useState(emptyCategory),[editingCategory,setEditingCategory]=useState("");
 const [coupon,setCoupon]=useState(emptyCoupon),[editingCoupon,setEditingCoupon]=useState("");
 const [history,setHistory]=useState([]),[historyProduct,setHistoryProduct]=useState("");

 async function load(){
  try{
   const token=await getAccessToken();
   const [d,l,r,appearance,cats,people,promos,team,zones,paymentRows,alerts]=await Promise.all([
    getAdminDashboard({data:{token}}),getAdminDeliveries({data:{token}}),getAdminReports({data:{token}}),
    getStorefrontSettings(),adminListCategories({data:{token}}),adminListCustomers({data:{token}}),adminListCoupons({data:{token}}),adminListStaff({data:{token}}),adminListDeliveryZones({data:{token}}),adminListPayments({data:{token}}),adminListNotifications({data:{token}}),
   ]);
   setData(d);setDeliveries(l);setReports(r);setCoverUrl(appearance.heroCoverUrl||"");
   setCategories(cats);setCustomers(people);setCoupons(promos);setStaff(team);setDeliveryZones(zones);setPayments(paymentRows);setAdminNotifications(alerts);setMessage("");
  }catch(e){setMessage(e.message||"Impossible de charger l'administration.");}
 }
 useEffect(()=>{load();},[]);
 async function act(fn,payload,success="Modification enregistrée."){
  setBusy(true);setMessage("");
  try{const token=await getAccessToken();await fn({data:{token,...payload}});setMessage(success);await load();return true;}
  catch(e){setMessage(e.message||"Opération impossible.");return false;}
  finally{setBusy(false);}
 }
 async function uploadImage(event){
  const file=event.target.files?.[0];if(!file)return;
  setBusy(true);setMessage("");
  try{
   const token=await getAccessToken();
   const signed=await getProductImageUploadUrl({data:{token,contentType:file.type,size:file.size}});
   const response=await fetch(signed.uploadUrl,{method:"PUT",headers:signed.headers,body:file});
   if(!response.ok)throw new Error("L'envoi de l'image a échoué.");
   setProduct(p=>({...p,imageUrl:signed.publicUrl,imageKey:signed.key}));
   setMessage("Image principale envoyée. Elle sera associée au produit à sa création.");
  }catch(e){setMessage(e.message||"Envoi impossible.");}
  finally{setBusy(false);event.target.value="";}
 }
 async function uploadGalleryImage(event,productId){
  const file=event.target.files?.[0];if(!file)return;
  setBusy(true);setMessage("");
  try{
   const token=await getAccessToken();
   const signed=await getProductImageUploadUrl({data:{token,contentType:file.type,size:file.size}});
   const response=await fetch(signed.uploadUrl,{method:"PUT",headers:signed.headers,body:file});
   if(!response.ok)throw new Error("Le transfert de l'image a échoué.");
   await adminAddProductImage({data:{token,productId,storageKey:signed.key,altText:file.name,isPrimary:false}});
   setMessage("Image ajoutée à la galerie du produit.");await load();
  }catch(e){setMessage(e.message||"Ajout de l'image impossible.");}
  finally{setBusy(false);event.target.value="";}
 }
 async function uploadCover(event){
  const file=event.target.files?.[0];if(!file)return;
  if(file.type!=="image/gif"){setMessage("Sélectionne un fichier GIF animé.");event.target.value="";return;}
  setBusy(true);setMessage("");
  try{
   const token=await getAccessToken();
   const signed=await getCoverImageUploadUrl({data:{token,contentType:file.type,size:file.size}});
   const response=await fetch(signed.uploadUrl,{method:"PUT",headers:signed.headers,body:file});
   if(!response.ok)throw new Error("Le transfert du GIF vers Neon a échoué.");
   const saved=await saveStorefrontCover({data:{token,publicUrl:signed.publicUrl}});
   setCoverUrl(saved.heroCoverUrl);setMessage("La couverture GIF animée est publiée.");
  }catch(e){setMessage(e.message||"Import de la couverture impossible.");}
  finally{setBusy(false);event.target.value="";}
 }
 async function createProduct(e){
  e.preventDefault();
  const ok=await act(adminCreateProduct,{...product,price:Number(product.price),oldPrice:product.oldPrice===""?null:Number(product.oldPrice),stock:Number(product.stock),lowStockThreshold:Number(product.lowStockThreshold),imageKey:product.imageKey},"Produit créé.");
  if(ok)setProduct({...emptyProduct,category:categories.find(c=>c.is_active)?.slug||""});
 }
 async function editProduct(p){
  const name=window.prompt("Nom du produit",p.name);if(name===null)return;
  const price=window.prompt("Prix actuel HTG",String(p.price));if(price===null)return;
  const old=window.prompt("Prix normal (laisser vide sans promotion)",p.old_price==null?"":String(p.old_price));if(old===null)return;
  const description=window.prompt("Description",p.description||"");if(description===null)return;
  const date=window.prompt("Fin de promotion (ISO, ex. 2026-12-31T23:59:00) ou vide",p.discount_ends_at||"");if(date===null)return;
  await act(adminUpdateProduct,{productId:p.id,name,price:Number(price),category:p.category,description,imageUrl:p.image_url,isActive:p.is_active,oldPrice:old===""?null:Number(old),discountEndsAt:date||null,lowStockThreshold:p.low_stock_threshold},"Produit modifié.");
 }
 async function saveZone(e){
  e.preventDefault();
  const payload={...zone,fee:Number(zone.fee),freeFrom:zone.freeFrom===""?null:Number(zone.freeFrom),minDays:Number(zone.minDays),maxDays:Number(zone.maxDays)};
  const ok=editingZoneId
    ? await act(adminUpdateDeliveryZone,{...payload,zoneId:editingZoneId},"Zone de livraison modifiée.")
    : await act(adminCreateDeliveryZone,payload,"Zone de livraison créée.");
  if(ok){setZone(emptyZone);setEditingZoneId("");}
 }
 async function createCourier(e){e.preventDefault();const ok=await act(adminCreateCourier,courier);if(ok)setCourier(emptyCourier);}
 async function createStaff(e){
  e.preventDefault();
  const ok=await act(adminAddStaff,newStaff,"Membre de l'équipe autorisé.");
  if(ok)setNewStaff(emptyStaff);
 }
 async function updateStaff(person,changes){
  await act(adminUpdateStaff,{userId:person.user_id,staffRole:changes.staffRole||person.staff_role,isActive:changes.isActive??person.is_active},"Responsabilités de l'employé mises à jour.");
 }
 async function saveCategory(e){
  e.preventDefault();const ok=await act(adminUpsertCategory,{...category,originalSlug:editingCategory||undefined,sortOrder:Number(category.sortOrder)},"Catégorie enregistrée.");
  if(ok){setCategory(emptyCategory);setEditingCategory("");}
 }
 async function saveCoupon(e){
  e.preventDefault();const ok=await act(adminUpsertCoupon,{...coupon,couponId:editingCoupon||undefined,discountValue:Number(coupon.discountValue),minimumOrder:Number(coupon.minimumOrder),maxUses:coupon.maxUses===""?null:Number(coupon.maxUses),startsAt:coupon.startsAt||null,endsAt:coupon.endsAt||null},"Promotion enregistrée.");
  if(ok){setCoupon(emptyCoupon);setEditingCoupon("");}
 }
 async function reconcilePayments(){
  setBusy(true);setMessage("");setReconcileResult(null);
  try{
   const token=await getAccessToken();
   const result=await adminReconcilePendingPayments({data:{token,limit:50}});
   setReconcileResult(result);
   setMessage(result.skipped ? result.message : `Vérification terminée : ${result.scanned} paiement(s), ${result.confirmed} confirmé(s), ${result.pending} en attente, ${result.errors} erreur(s).`);
   await load();
  }catch(e){setMessage(e.message||"Impossible de vérifier les paiements.");}
  finally{setBusy(false);}
 }
 async function requestRefund(paymentId,amount,reason){
  return act(adminCreateRefund,{paymentId,amount:Number(amount),reason,idempotencyKey:crypto.randomUUID()},"Demande de remboursement enregistrée. Son paiement reste à effectuer manuellement.");
 }
 async function updateRefund(refundId,status,externalReference,proofStorageKey){
  return act(adminUpdateRefund,{refundId,status,externalReference,proofStorageKey},"Statut du remboursement enregistré.");
 }
 async function uploadRefundProof(refundId,file){
  if(!file)throw new Error("Sélectionnez un justificatif.");
  const token=await getAccessToken();
  const signed=await getRefundProofUploadUrl({data:{token,refundId,contentType:file.type,size:file.size}});
  const response=await fetch(signed.uploadUrl,{method:"PUT",headers:signed.headers,body:file});
  if(!response.ok)throw new Error("L'envoi du justificatif a échoué.");
  return signed.key;
 }
 async function viewRefundProof(refundId){
  const token=await getAccessToken();
  const result=await getRefundProofDownloadUrl({data:{token,refundId}});
  window.open(result.url,"_blank","noopener,noreferrer");
 }
 function exportCsv(filename,rows,columns){
  const quote=value=>'"'+String(value??"").replace(/"/g,'""')+'"';
  const csv=[columns.map(col=>quote(col.label)).join(","),...rows.map(row=>columns.map(col=>quote(col.get(row))).join(","))].join("\r\n");
  const blob=new Blob(["\\uFEFF",csv],{type:"text/csv;charset=utf-8"});
  const url=URL.createObjectURL(blob),link=document.createElement("a");
  link.href=url;link.download=filename;document.body.appendChild(link);link.click();link.remove();URL.revokeObjectURL(url);
 }
 async function showStockHistory(p){
  setHistoryProduct(p.id);setHistory([]);
  try{const token=await getAccessToken();setHistory(await adminGetProductStockHistory({data:{token,productId:p.id}}));}
  catch(e){setMessage(e.message);}
 }
 async function releaseExpired(){
  const ok=await act(adminReleaseExpiredReservations,{},"Réservations expirées contrôlées.");
  if(ok)await load();
 }

 return <main className="commerce-page">
  <header className="commerce-header"><Link to="/">← Boutique</Link><strong className="commerce-brand"><img src="/images/lama-market-logo.svg" alt="" aria-hidden="true"/>Administration Lama Market</strong><Link to="/equipe">Espace équipe</Link><Link to="/compte">Mon compte</Link></header>
  <div className="commerce-container">
   <div className="commerce-title"><span>GESTION DE LA BOUTIQUE</span><h1>Tableau de bord</h1><p>Catalogue, commandes, clients, équipe, livreurs, promotions et stocks.</p></div>
   {message&&<div className="form-message admin-notice" role="status">{message}</div>}
   {data&&<>
    <section className="commerce-panel admin-cover-panel">
     <div className="admin-cover-heading"><div><h2>Couverture animée de la boutique</h2><p>GIF en lecture accélérée 2× · 5 Mo maximum.</p></div>{coverUrl&&<span className="cover-current-label">Couverture configurée</span>}</div>
     {coverUrl&&<img className="admin-cover-preview" src={coverUrl} alt="Aperçu de la couverture actuelle"/>}
     <label>Choisir le fichier GIF<input type="file" accept="image/gif,.gif" onChange={uploadCover} disabled={busy}/></label>
    </section>
    <div className="admin-stat-grid">
     <Stat label="Commandes" value={data.stats.total_orders}/><Stat label="Commandes actives" value={data.stats.active_orders}/>
     <Stat label="Recettes encaissées" value={money.format(Number(data.stats.revenue))}/><Stat label="Alertes de stock" value={data.lowStock.length}/>
     <Stat label="Clients" value={customers.length}/><Stat label="Livreurs actifs" value={data.couriers.filter(c=>c.is_active).length}/>
    </div>

    <section className="commerce-panel">
     <h2>Créer un produit</h2>
     <form className="account-form" onSubmit={createProduct}>
      <div className="form-two"><label>Nom<input required value={product.name} onChange={e=>setProduct({...product,name:e.target.value})}/></label>
       <label>Catégorie<select required value={product.category} onChange={e=>setProduct({...product,category:e.target.value})}><option value="">Choisir une catégorie</option>{categories.filter(c=>c.is_active).map(c=><option key={c.slug} value={c.slug}>{c.name}</option>)}</select></label></div>
      <div className="form-two"><label>Prix promotionnel / actuel (HTG)<input type="number" min="0" step="0.01" required value={product.price} onChange={e=>setProduct({...product,price:e.target.value})}/></label>
       <label>Prix normal (HTG, facultatif)<input type="number" min="0" step="0.01" value={product.oldPrice} onChange={e=>setProduct({...product,oldPrice:e.target.value})}/></label></div>
      <div className="form-two"><label>Fin de promotion<input type="datetime-local" value={product.discountEndsAt} onChange={e=>setProduct({...product,discountEndsAt:e.target.value})}/></label>
       <label>Référence / SKU<input value={product.sku} onChange={e=>setProduct({...product,sku:e.target.value})}/></label></div>
      <div className="form-two"><label>Stock initial<input type="number" min="0" required value={product.stock} onChange={e=>setProduct({...product,stock:e.target.value})}/></label>
       <label>Seuil d'alerte<input type="number" min="0" value={product.lowStockThreshold} onChange={e=>setProduct({...product,lowStockThreshold:e.target.value})}/></label></div>
      <label>Description<textarea value={product.description} onChange={e=>setProduct({...product,description:e.target.value})}/></label>
      <label>Image principale (JPG, PNG, WebP · 5 Mo max)<input type="file" accept="image/jpeg,image/png,image/webp" onChange={uploadImage} disabled={busy}/></label>
      {product.imageUrl&&<img src={product.imageUrl} alt="Aperçu du produit" className="admin-image-preview"/>}
      <label>Ou URL d'image externe<input value={product.imageUrl} onChange={e=>setProduct({...product,imageUrl:e.target.value,imageKey:""})}/></label>
      <label className="check-label"><input type="checkbox" checked={product.isActive} onChange={e=>setProduct({...product,isActive:e.target.checked})}/> Publier immédiatement</label>
      <button className="account-submit" disabled={busy||!categories.some(c=>c.slug===product.category&&c.is_active)}>Enregistrer le produit</button>
     </form>
    </section>

    <div className="admin-grid">
     <section className="commerce-panel"><h2>Zones et frais de livraison</h2>
      <form className="account-form" onSubmit={saveZone}>
       <div className="form-two"><label>Nom de la zone<input required value={zone.name} onChange={e=>setZone({...zone,name:e.target.value})}/></label><label>Département<input value={zone.department} onChange={e=>setZone({...zone,department:e.target.value})}/></label></div>
       <div className="form-two"><label>Ville<input required value={zone.city} onChange={e=>setZone({...zone,city:e.target.value})}/></label><label>Quartier / zone<input value={zone.area} onChange={e=>setZone({...zone,area:e.target.value})}/></label></div>
       <div className="form-two"><label>Frais (HTG)<input type="number" min="0" step="0.01" required value={zone.fee} onChange={e=>setZone({...zone,fee:e.target.value})}/></label><label>Livraison gratuite à partir de (HTG)<input type="number" min="0" value={zone.freeFrom} onChange={e=>setZone({...zone,freeFrom:e.target.value})}/></label></div>
       <div className="form-two"><label>Délai min. jours<input type="number" min="0" value={zone.minDays} onChange={e=>setZone({...zone,minDays:e.target.value})}/></label><label>Délai max. jours<input type="number" min="1" value={zone.maxDays} onChange={e=>setZone({...zone,maxDays:e.target.value})}/></label></div>
       <label className="check-label"><input type="checkbox" checked={zone.isActive} onChange={e=>setZone({...zone,isActive:e.target.checked})}/> Zone active</label>
       <div className="address-actions"><button className="account-submit" disabled={busy}>{editingZoneId?"Enregistrer la zone":"Créer la zone"}</button>{editingZoneId&&<button type="button" className="text-button" onClick={()=>{setEditingZoneId("");setZone(emptyZone);}}>Annuler</button>}</div>
      </form>
      {deliveryZones.map(z=><div className="table-line" key={z.id}>
       <span><strong>{z.name}</strong><small>{z.department||""} · {z.city}{z.area?" · "+z.area:""} · {money.format(Number(z.fee||0))}{z.free_from!=null?" · Gratuit dès "+money.format(Number(z.free_from)):""} · {z.is_active&&z.rate_is_active?"Active":"Désactivée"}</small></span>
       <button className="text-button" onClick={()=>{setEditingZoneId(z.id);setZone({name:z.name,department:z.department||"",city:z.city,area:z.area||"",fee:String(z.fee??0),freeFrom:z.free_from==null?"":String(z.free_from),minDays:String(z.estimated_min_days??1),maxDays:String(z.estimated_max_days??3),isActive:z.is_active&&z.rate_is_active!==false});}}>Modifier</button>
       <button className="text-button" disabled={!z.is_active||busy} onClick={()=>act(adminArchiveDeliveryZone,{zoneId:z.id},"Zone de livraison désactivée.")}>Désactiver</button>
      </div>)}
      {!deliveryZones.length&&<p className="muted-note">Aucune zone configurée.</p>}
     </section>
     <section className="commerce-panel"><h2>Ajouter un livreur</h2><p className="muted-note">Le livreur doit d'abord créer son compte Lama Market. Son e-mail sera ensuite autorisé à accéder à son espace.</p>
      <form className="account-form" onSubmit={createCourier}>
       <label>E-mail du compte<input type="email" required value={courier.email} onChange={e=>setCourier({...courier,email:e.target.value})}/></label>
       <label>Nom affiché<input required value={courier.displayName} onChange={e=>setCourier({...courier,displayName:e.target.value})}/></label>
       <label>Téléphone<input required value={courier.phone} onChange={e=>setCourier({...courier,phone:e.target.value})}/></label>
       <label>Statut<select value={courier.employmentType} onChange={e=>setCourier({...courier,employmentType:e.target.value})}><option value="employee">Employé</option><option value="mandated">Mandaté</option></select></label>
       <button className="account-submit" disabled={busy}>Autoriser ce livreur</button>
      </form>
     </section>
    </div>

    <section className="commerce-panel">
     <div className="staff-section-heading"><div><span className="section-kicker">TAXONOMIE</span><h2>Catégories du catalogue</h2></div><span className="staff-count">{categories.length}</span></div>
     <form className="account-form" onSubmit={saveCategory}>
      <div className="form-two"><label>Nom de la catégorie<input required value={category.name} onChange={e=>setCategory({...category,name:e.target.value})}/></label><label>Identifiant / slug<input value={category.slug} onChange={e=>setCategory({...category,slug:e.target.value})} placeholder="Créé automatiquement si vide"/></label></div>
      <label>Description<textarea value={category.description} onChange={e=>setCategory({...category,description:e.target.value})}/></label>
      <div className="form-two"><label>Ordre d'affichage<input type="number" value={category.sortOrder} onChange={e=>setCategory({...category,sortOrder:e.target.value})}/></label><label>Image de catégorie (URL)<input value={category.imageUrl} onChange={e=>setCategory({...category,imageUrl:e.target.value})}/></label></div>
      <label className="check-label"><input type="checkbox" checked={category.isActive} onChange={e=>setCategory({...category,isActive:e.target.checked})}/> Catégorie active</label>
      <div className="address-actions"><button className="account-submit" disabled={busy}>{editingCategory?"Enregistrer la catégorie":"Ajouter la catégorie"}</button>{editingCategory&&<button type="button" className="text-button" onClick={()=>{setEditingCategory("");setCategory(emptyCategory);}}>Annuler</button>}</div>
     </form>
     {categories.map(c=><div className="table-line" key={c.slug}><span><strong>{c.name}</strong><small> · {c.slug} · {c.product_count} produit(s) · {c.is_active?"Active":"Masquée"}</small></span><button className="text-button" onClick={()=>{setEditingCategory(c.slug);setCategory({name:c.name,slug:c.slug,description:c.description||"",imageUrl:c.image_url||"",sortOrder:String(c.sort_order),isActive:c.is_active});}}>Modifier</button><button className="text-button" disabled={busy||Number(c.product_count)>0&&c.is_active} onClick={()=>act(adminArchiveCategory,{slug:c.slug},"Catégorie masquée.")}>Masquer</button></div>)}
    </section>

    <section className="commerce-panel">
     <h2>Catalogue et galeries produits</h2>
     {data.products.map(p=><article className="admin-product-card" key={p.id}>
      <div className="admin-product-line">{p.image_url?<img src={p.image_url} alt={p.name}/>:<div className="cart-placeholder">LM</div>}<div className="admin-product-info"><strong>{p.name}</strong><small>{p.category} · {money.format(Number(p.price))}{p.old_price? " · Prix normal "+money.format(Number(p.old_price)):""} · Stock : {p.stock} · {p.sku||"Sans SKU"}</small><small>{p.is_active?"Publié":"Masqué"} · {p.images?.length||0} image(s)</small></div><button className="text-button" onClick={()=>editProduct(p)}>Modifier</button><button className="text-button" onClick={()=>act(adminUpdateProduct,{productId:p.id,name:p.name,price:Number(p.price),category:p.category,description:p.description,imageUrl:p.image_url,isActive:!p.is_active,oldPrice:p.old_price,discountEndsAt:p.discount_ends_at,lowStockThreshold:p.low_stock_threshold})}>{p.is_active?"Masquer":"Publier"}</button><button className="text-button" onClick={()=>showStockHistory(p)}>Historique du stock</button><button className="text-button" onClick={()=>{if(window.confirm("Archiver ce produit ?"))act(adminArchiveProduct,{productId:p.id},"Produit archivé.");}}>Archiver</button></div>
      <div className="admin-product-gallery">
       {(p.images||[]).map(image=><div className="admin-gallery-item" key={image.id}>{image.url&&<img src={image.url} alt={image.alt_text||p.name}/>}<span>{image.is_primary?"Principale":"Secondaire"}</span>{!image.is_primary&&<button className="text-button" onClick={()=>act(adminSetPrimaryProductImage,{imageId:image.id},"Image principale mise à jour.")}>Définir principale</button>}<button className="text-button" onClick={()=>act(adminDeleteProductImage,{imageId:image.id},"Image supprimée.")}>Supprimer</button></div>)}
       <label>Ajouter une image<input type="file" accept="image/jpeg,image/png,image/webp" disabled={busy||(p.images?.length||0)>=8} onChange={e=>uploadGalleryImage(e,p.id)}/></label>
      </div>
     </article>)}
     {!data.products.length&&<p className="muted-note">Aucun produit enregistré.</p>}
    </section>

    {historyProduct&&<section className="commerce-panel"><div className="staff-section-heading"><h2>Historique des mouvements de stock</h2><button className="text-button" onClick={()=>{setHistoryProduct("");setHistory([]);}}>Fermer</button></div>{history.map(item=><div className="table-line" key={item.id}><span>{new Date(item.created_at).toLocaleString("fr-FR")} · {item.movement_type}<small>{item.note||""} · {item.actor_name||"Système"}</small></span><strong>{Number(item.quantity_delta)>0?"+":""}{item.quantity_delta}</strong></div>)}{!history.length&&<p className="muted-note">Aucun mouvement enregistré.</p>}</section>}

    <section className="commerce-panel">
     <h2>Codes promotionnels et coupons</h2>
     <form className="account-form" onSubmit={saveCoupon}>
      <div className="form-two"><label>Code<input required value={coupon.code} onChange={e=>setCoupon({...coupon,code:e.target.value.toUpperCase()})}/></label><label>Type de remise<select value={coupon.discountType} onChange={e=>setCoupon({...coupon,discountType:e.target.value})}><option value="percent">Pourcentage</option><option value="fixed">Montant fixe (HTG)</option></select></label></div>
      <div className="form-two"><label>Valeur de remise<input type="number" min="0.01" step="0.01" required value={coupon.discountValue} onChange={e=>setCoupon({...coupon,discountValue:e.target.value})}/></label><label>Commande minimum (HTG)<input type="number" min="0" value={coupon.minimumOrder} onChange={e=>setCoupon({...coupon,minimumOrder:e.target.value})}/></label></div>
      <div className="form-two"><label>Nombre max. d'utilisations<input type="number" min="1" value={coupon.maxUses} onChange={e=>setCoupon({...coupon,maxUses:e.target.value})} placeholder="Illimité"/></label><label>Début<input type="datetime-local" value={coupon.startsAt} onChange={e=>setCoupon({...coupon,startsAt:e.target.value})}/></label></div>
      <label>Fin<input type="datetime-local" value={coupon.endsAt} onChange={e=>setCoupon({...coupon,endsAt:e.target.value})}/></label>
      <label className="check-label"><input type="checkbox" checked={coupon.isActive} onChange={e=>setCoupon({...coupon,isActive:e.target.checked})}/> Actif</label>
      <div className="address-actions"><button className="account-submit" disabled={busy}>{editingCoupon?"Mettre à jour":"Créer le coupon"}</button>{editingCoupon&&<button type="button" className="text-button" onClick={()=>{setEditingCoupon("");setCoupon(emptyCoupon);}}>Annuler</button>}</div>
     </form>
     {coupons.map(c=><div className="table-line" key={c.id}><span><strong>{c.code}</strong><small> · {c.discount_type==="percent"?c.discount_value+" %":money.format(Number(c.discount_value))} · {c.redeemed} utilisation(s) · {c.is_active?"Actif":"Archivé"}</small></span><button className="text-button" onClick={()=>{setEditingCoupon(c.id);setCoupon({code:c.code,discountType:c.discount_type,discountValue:String(c.discount_value),minimumOrder:String(c.minimum_order),maxUses:c.max_uses==null?"":String(c.max_uses),startsAt:c.starts_at?new Date(c.starts_at).toISOString().slice(0,16):"",endsAt:c.ends_at?new Date(c.ends_at).toISOString().slice(0,16):"",isActive:c.is_active});}}>Modifier</button><button className="text-button" disabled={!c.is_active||busy} onClick={()=>act(adminArchiveCoupon,{couponId:c.id},"Coupon archivé.")}>Archiver</button></div>)}
    </section>

    <section className="commerce-panel">
     <h2>Gestion des employés et responsabilités</h2>
     <p className="muted-note">La personne doit d'abord créer son compte Lama Market avec son adresse e-mail.</p>
     <form className="account-form" onSubmit={createStaff}>
      <div className="form-two">
       <label>E-mail du compte<input type="email" required value={newStaff.email} onChange={e=>setNewStaff({...newStaff,email:e.target.value})}/></label>
       <label>Nom affiché<input required value={newStaff.displayName} onChange={e=>setNewStaff({...newStaff,displayName:e.target.value})}/></label>
      </div>
      <div className="form-two">
       <label>Téléphone<input value={newStaff.phone} onChange={e=>setNewStaff({...newStaff,phone:e.target.value})}/></label>
       <label>Responsabilité<select value={newStaff.staffRole} onChange={e=>setNewStaff({...newStaff,staffRole:e.target.value})}>
        <option value="manager">Responsable de magasin</option><option value="cashier">Caisse</option><option value="inventory">Inventaire</option><option value="fulfillment">Préparation des commandes</option>
       </select></label>
      </div>
      <button className="account-submit" disabled={busy}>Ajouter à l'équipe</button>
     </form>
     {staff.map(person=><div className="table-line" key={person.user_id}>
      <span><strong>{person.display_name}</strong><small>{person.email} · {person.phone||"Sans téléphone"}</small></span>
      <select value={person.staff_role} disabled={busy} onChange={e=>updateStaff(person,{staffRole:e.target.value})}>
       <option value="manager">Responsable de magasin</option><option value="cashier">Caisse</option><option value="inventory">Inventaire</option><option value="fulfillment">Préparation des commandes</option>
      </select>
      <button className="text-button" disabled={busy} onClick={()=>updateStaff(person,{isActive:!person.is_active})}>{person.is_active?"Désactiver":"Réactiver"}</button>
     </div>)}
     {!staff.length&&<p className="muted-note">Aucun employé autorisé pour le moment.</p>}
    </section>

    <section className="commerce-panel">
     <h2>Clients</h2>
     <div className="table-line"><strong>{customers.length} compte(s) client</strong></div>
     {customers.map(person=><div className="table-line" key={person.id}><span><strong>{person.preferred_name||person.name||person.email}</strong><small>{person.email} · {person.phone||"Téléphone non renseigné"} · {person.order_count} commande(s) · Dernier achat : {person.last_order_at?new Date(person.last_order_at).toLocaleDateString("fr-FR"):"Aucun"}</small></span><strong>{money.format(Number(person.total_paid))}</strong></div>)}
    </section>

    <section className="commerce-panel">
     <h2>Alertes et mouvements d'inventaire</h2>
     <button className="text-button" disabled={busy} onClick={releaseExpired}>Libérer les réservations expirées</button>
     {data.lowStock.map(p=><div className="table-line" key={p.id}><span>{p.name}</span><strong>{p.stock} / seuil {p.low_stock_threshold}</strong><button className="text-button" onClick={()=>{const value=window.prompt("Variation de stock (8 pour ajouter, -2 pour retirer)");if(value!==null&&value.trim())act(adminAdjustStock,{productId:p.id,delta:Number(value),note:"Ajustement depuis le tableau de bord"});}}>Ajuster le stock</button></div>)}
     {!data.lowStock.length&&<p className="muted-note">Aucune alerte de stock.</p>}
    </section>

    <section className="commerce-panel">
     <div className="staff-section-heading"><div><span className="section-kicker">ENCAISSEMENTS</span><h2>Historique des paiements et remboursements</h2></div><span className="staff-count">{payments.length}</span></div>
     <p className="muted-note">Le remboursement est enregistré après son exécution effective hors boutique. La référence de transaction et le justificatif sont obligatoires pour le clôturer.</p>
     <button type="button" className="text-button" disabled={busy} onClick={reconcilePayments}>Vérifier les paiements mobiles en attente</button>
     {reconcileResult&&<div className="form-message" role="status">{reconcileResult.results?.map((r,i)=><div key={i}>{r.orderNumber} · {r.status}{r.message?" · "+r.message:""}</div>)}</div>}
     {payments.map(payment=><PaymentAdminRow key={payment.id} payment={payment} busy={busy} onRequest={requestRefund} onUpdate={updateRefund} onUpload={uploadRefundProof} onViewProof={viewRefundProof}/>)}
     {!payments.length&&<p className="muted-note">Aucun paiement enregistré.</p>}
    </section>
    <section className="commerce-panel">
     <div className="staff-section-heading"><div><span className="section-kicker">CENTRE DE NOTIFICATIONS</span><h2>Alertes administratives</h2></div><span className="staff-count">{adminNotifications.length}</span></div>
     {adminNotifications.map(item=><div className="notification-row" key={item.id}><strong>{item.title}</strong><p>{item.message}</p><small>{new Date(item.created_at).toLocaleString("fr-FR")} · E-mail : {item.email_status||"non envoyé"}{item.email_error?" · "+item.email_error:""}</small></div>)}
     {!adminNotifications.length&&<p className="muted-note">Aucune alerte administrative enregistrée.</p>}
    </section>
    <section className="commerce-panel"><h2>Commandes récentes</h2>
     {data.orders.map(o=><div className="admin-order-line" key={o.id}><div><strong>{o.order_number}</strong><small>{o.status} · {o.payment_status} · {o.delivery_status}</small></div><strong>{money.format(Number(o.total))}</strong>
      <select value={o.status} onChange={e=>act(adminUpdateOrderStatus,{orderId:o.id,status:e.target.value})}><option value="confirmed">Confirmée</option><option value="preparing">En préparation</option><option value="ready_for_delivery">Prête à livrer</option><option value="completed">Terminée</option><option value="cancelled">Annulée</option></select>
     </div>)}
    </section>

    <section className="commerce-panel"><h2>Affecter les livraisons</h2>
     {deliveries.filter(d=>["unassigned","failed"].includes(d.status)).map(d=><div className="admin-order-line delivery-admin-line" key={d.id}>
      <div><strong>{d.order_number} · {d.address_snapshot?.recipientName}</strong><small>{d.address_snapshot?.phone} · {d.address_snapshot?.addressLine}</small><small>{d.address_snapshot?.area} · {d.address_snapshot?.city} · {d.failure_reason||""}</small></div>
      <select defaultValue="" onChange={e=>{if(e.target.value)act(adminAssignCourier,{deliveryId:d.id,courierId:e.target.value});}}><option value="" disabled>Choisir un livreur</option>{data.couriers.filter(c=>c.is_active).map(c=><option key={c.user_id} value={c.user_id}>{c.display_name}</option>)}</select>
     </div>)}
     {!deliveries.some(d=>["unassigned","failed"].includes(d.status))&&<p className="muted-note">Aucune livraison à affecter.</p>}
    </section>

    <section className="commerce-panel"><h2>Suivi des livraisons</h2>
     {deliveries.map(d=><div className="table-line" key={d.id}><span><strong>{d.order_number}</strong><small>{d.address_snapshot?.recipientName} · {d.address_snapshot?.phone} · {d.address_snapshot?.addressLine}, {d.address_snapshot?.city} · {d.status}</small></span><span>{d.courier_name||"Non attribuée"}</span>{d.proof_url&&<span>Preuve ajoutée</span>}</div>)}
    </section>

    <section className="commerce-panel">
     <div className="staff-section-heading"><div><span className="section-kicker">ANALYSE COMMERCIALE</span><h2>Rapports et suivi commercial · 90 jours</h2></div></div>
     <div className="admin-stat-grid">
      <Stat label="Commandes réglées" value={reports?.summary?.paid_orders??0}/>
      <Stat label="Commandes totales" value={reports?.summary?.total_orders??0}/>
      <Stat label="Montant encaissé" value={money.format(Number(reports?.summary?.net_collected||0))}/>
      <Stat label="Montant brut reconnu" value={money.format(Number(reports?.summary?.gross_revenue||0))}/>
      <Stat label="Panier moyen encaissé" value={money.format(Number(reports?.summary?.average_order||0))}/>
      <Stat label="Paiements en attente" value={reports?.summary?.pending_payments??0}/>
      <Stat label="Paiements échoués" value={reports?.summary?.failed_payments??0}/>
     </div>
     <div className="report-export-actions">
      <button className="text-button" onClick={()=>exportCsv("lama-market-ventes-90-jours.csv",reports?.daily||[],[{label:"Date",get:r=>r.sales_day},{label:"Commandes",get:r=>r.orders},{label:"Ventes HTG",get:r=>r.sales}])}>Exporter ventes CSV</button>
      <button className="text-button" onClick={()=>exportCsv("lama-market-produits-vendus.csv",reports?.topProducts||[],[{label:"Produit",get:r=>r.product_name},{label:"Quantité",get:r=>r.quantity},{label:"Ventes HTG",get:r=>r.sales}])}>Exporter produits CSV</button>
      <button className="text-button" onClick={()=>exportCsv("lama-market-stocks.csv",reports?.stock||[],[{label:"Produit",get:r=>r.name},{label:"SKU",get:r=>r.sku},{label:"Catégorie",get:r=>r.category},{label:"Stock",get:r=>r.stock},{label:"Seuil",get:r=>r.low_stock_threshold},{label:"Actif",get:r=>r.is_active}])}>Exporter stocks CSV</button>
      <button className="text-button" onClick={()=>exportCsv("lama-market-paiements.csv",payments,[{label:"Commande",get:r=>r.order_number},{label:"Client",get:r=>r.customer_name},{label:"Méthode",get:r=>r.method},{label:"Fournisseur",get:r=>r.provider},{label:"Montant HTG",get:r=>r.amount},{label:"Statut",get:r=>r.status},{label:"Référence",get:r=>r.external_reference},{label:"Date",get:r=>r.created_at}])}>Exporter paiements CSV</button>
     </div>
     <h3>Historique des ventes</h3>
     <div className="report-table-wrap"><table className="report-table"><thead><tr><th>Date</th><th>Commandes encaissées</th><th>Ventes HTG</th></tr></thead><tbody>{reports?.daily.map(d=><tr key={d.sales_day}><td>{new Date(d.sales_day).toLocaleDateString("fr-FR")}</td><td>{d.orders}</td><td>{money.format(Number(d.sales))}</td></tr>)}</tbody></table></div>
     <h3>Produits les plus vendus</h3>
     {(reports?.topProducts||[]).map((p,i)=><div className="table-line" key={p.product_name}><span>{i+1}. {p.product_name}</span><span>{p.quantity} vendu(s)</span><strong>{money.format(Number(p.sales))}</strong></div>)}
     <h3>État des stocks</h3>
     {(reports?.stock||[]).slice(0,20).map(p=><div className="table-line" key={p.id}><span><strong>{p.name}</strong><small>{p.sku||"Sans référence"} · {p.category}</small></span><span>{p.stock} en stock</span><strong>Seuil {p.low_stock_threshold}</strong></div>)}
     <h3>Encaissements par moyen de paiement</h3>
     {(reports?.paymentMethods||[]).map(p=><div className="table-line" key={p.method}><span>{p.method}</span><span>{p.transactions} transaction(s)</span><strong>{money.format(Number(p.collected))}</strong></div>)}
    </section>
   </>}
  </div>
 </main>;
}
function Stat({label,value}){return <div className="admin-stat"><small>{label}</small><strong>{value}</strong></div>}

function PaymentAdminRow({payment,busy,onRequest,onUpdate,onUpload,onViewProof}){
 const [amount,setAmount]=useState("");
 const [reason,setReason]=useState("");
 const [draftError,setDraftError]=useState("");
 const money=new Intl.NumberFormat("fr-HT",{style:"currency",currency:"HTG"});
 const refunds=payment.refunds||[];
 const canRefund=["paid","cash_collected","partially_refunded"].includes(payment.status);
 async function request(event){
  event.preventDefault();setDraftError("");
  const ok=await onRequest(payment.id,amount,reason);
  if(ok){setAmount("");setReason("");}
 }
 return <article className="payment-admin-card">
  <div className="payment-admin-heading"><div><strong>{payment.order_number}</strong><small>{payment.customer_name||payment.email} · {payment.method} · {payment.provider||"Paiement direct"}</small></div><div><strong>{money.format(Number(payment.amount))}</strong><span className={"payment-status status-"+payment.status}>{payment.status}</span></div></div>
  {payment.external_reference&&<p className="muted-note">Référence : {payment.external_reference}</p>}
  <p className="muted-note">Montant déjà remboursé : {money.format(Number(payment.refunded_total||0))} · Commande : {payment.order_status}</p>
  {refunds.map(refund=><RefundAdminRow key={refund.id} refund={refund} busy={busy} onUpdate={onUpdate} onUpload={onUpload} onViewProof={onViewProof}/>)}
  {canRefund&&<form className="account-form refund-request-form" onSubmit={request}>
   <strong>Enregistrer une demande de remboursement</strong>
   <div className="form-two"><label>Montant HTG<input type="number" min="0.01" max={Math.max(0,Number(payment.amount)-Number(payment.refunded_total||0))} step="0.01" required value={amount} onChange={e=>setAmount(e.target.value)}/></label><label>Motif<input required maxLength={500} value={reason} onChange={e=>setReason(e.target.value)}/></label></div>
   {draftError&&<small role="alert">{draftError}</small>}
   <button className="account-submit" disabled={busy}>Créer la demande</button>
  </form>}
 </article>;
}
function RefundAdminRow({refund,busy,onUpdate,onUpload,onViewProof}){
 const [status,setStatus]=useState(refund.status);
 const [reference,setReference]=useState(refund.externalReference||"");
 const [file,setFile]=useState(null);
 const [error,setError]=useState("");
 const [uploading,setUploading]=useState(false);
 const money=new Intl.NumberFormat("fr-HT",{style:"currency",currency:"HTG"});
 async function save(){
  setError("");setUploading(true);
  try{
   let proof=refund.proofStorageKey||"";
   if(file){proof=await onUpload(refund.id,file);}
   await onUpdate(refund.id,status,reference,proof);
  }catch(e){setError(e.message||"Mise à jour impossible.");}
  finally{setUploading(false);}
 }
 return <div className="refund-admin-row">
  <div className="payment-admin-heading"><strong>{money.format(Number(refund.amount))}</strong><span className={"payment-status status-"+status}>{status}</span></div>
  <p>{refund.reason}</p>
  <div className="form-two">
   <label>Statut<select value={status} disabled={refund.status==="completed"||busy} onChange={e=>setStatus(e.target.value)}><option value="requested">Demandé</option><option value="processing">En traitement</option><option value="completed">Effectué</option><option value="failed">Échoué</option><option value="cancelled">Annulé</option></select></label>
   <label>Référence du remboursement<input value={reference} disabled={refund.status==="completed"||busy} onChange={e=>setReference(e.target.value)} placeholder="Référence du transfert"/></label>
  </div>
  <label>Justificatif du remboursement (PDF, JPG, PNG, WebP · 8 Mo maximum)<input type="file" accept="application/pdf,image/jpeg,image/png,image/webp" disabled={refund.status==="completed"||busy} onChange={e=>setFile(e.target.files?.[0]||null)}/></label>
  {refund.proofStorageKey&&<button type="button" className="text-button" onClick={()=>onViewProof(refund.id)}>Ouvrir le justificatif sécurisé</button>}
  {error&&<div className="form-message" role="alert">{error}</div>}
  <button type="button" className="account-submit" disabled={busy||uploading||refund.status==="completed"} onClick={save}>{uploading?"Envoi…":"Enregistrer le remboursement"}</button>
 </div>;
}
