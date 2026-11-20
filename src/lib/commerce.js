import { createServerFn } from "@tanstack/react-start";
async function getDb() { return (await import("./db.server")).getDb(); }
async function ensureCustomer(token) { return (await import("./auth.server")).ensureCustomer(token); }
async function requireRole(token, roles) { return (await import("./auth.server")).requireRole(token, roles); }
async function requireUser(token) { return (await import("./auth.server")).requireUser(token); }

const fail = (message, status = 400) => {
  const error = new Error(message);
  error.status = status;
  throw error;
};
const clean = (value, max = 500) => String(value ?? "").trim().slice(0, max);

export const getCatalog = createServerFn({ method: "GET" }).handler(async () => {
  const db = await getDb();
  const [products, categories] = await Promise.all([
    db.query(`select p.id,p.name,p.description,p.category,p.price,p.old_price,p.discount_ends_at,p.stock,p.badge,p.rating,p.reviews,p.image_url,p.is_active,p.sort_order,p.sku,p.slug,p.is_featured,
      coalesce((select json_agg(json_build_object('id',pi.id,'storage_key',pi.storage_key,'altText',pi.alt_text,'isPrimary',pi.is_primary,'sortOrder',pi.sort_order) order by pi.is_primary desc,pi.sort_order,pi.created_at) from public.product_images pi where pi.product_id=p.id),'[]'::json) images
      from public.products p where p.is_active=true and p.deleted_at is null order by p.is_featured desc,p.sort_order asc,p.name asc`),
    db.query("select slug,name from public.categories where is_active=true order by sort_order"),
  ]);
  const endpoint = process.env.AWS_ENDPOINT_URL_S3?.replace(/\/$/, "");
  const imageBase = endpoint ? `${endpoint}/product-images/` : "";
  const rows = products.rows.map((product) => ({
    ...product,
    images: (product.images || []).map((image) => ({
      ...image,
      url: image.url || (imageBase && image.storage_key ? imageBase + image.storage_key : null),
    })),
  }));
  return { products: rows, categories: categories.rows };
});

export const getMyProfile = createServerFn({ method: "GET" }).validator((data) => data).handler(async ({ data }) => {
  const user = await ensureCustomer(data.token);
  const db = await getDb();
  const result = await db.query("select cp.phone,cp.preferred_name,u.name,u.email from public.customer_profiles cp join neon_auth.\"user\" u on u.id=cp.user_id where cp.user_id=$1", [user.id]);
  return { user, profile: result.rows[0] ?? null };
});

export const updateMyProfile = createServerFn({ method: "POST" }).validator((data) => data).handler(async ({ data }) => {
  const user = await ensureCustomer(data.token);
  const db = await getDb();
  const phone = clean(data.phone, 40);
  const preferredName = clean(data.preferredName, 120);
  await db.query("update public.customer_profiles set phone=$2,preferred_name=$3,updated_at=now() where user_id=$1", [user.id, phone || null, preferredName || null]);
  return { ok: true };
});

export const getMyCart = createServerFn({ method: "GET" }).validator((data) => data).handler(async ({ data }) => {
  const user = await ensureCustomer(data.token);
  const db = await getDb();
  const result = await db.query(
    "select ci.id,ci.product_id,ci.quantity,p.name,p.price,p.old_price,p.discount_ends_at,p.stock,p.image_url,p.is_active from public.carts c join public.cart_items ci on ci.cart_id=c.id join public.products p on p.id=ci.product_id where c.user_id=$1 and c.status='active' order by ci.created_at",
    [user.id],
  );
  return result.rows;
});

export const addCartItem = createServerFn({ method: "POST" }).validator((data) => data).handler(async ({ data }) => {
  const user = await ensureCustomer(data.token);
  const quantity = Math.max(1, Math.min(99, Number(data.quantity) || 1));
  const db = await getDb();
  const client = await db.connect();
  try {
    await client.query("begin");
    const product = await client.query("select id,stock from public.products where id=$1 and is_active=true and deleted_at is null for update", [data.productId]);
    if (!product.rowCount) fail("Ce produit n'est plus disponible.");
    const cart = await client.query("insert into public.carts(user_id) values($1) on conflict(user_id) do update set status='active',updated_at=now() returning id", [user.id]);
    const item = await client.query("insert into public.cart_items(cart_id,product_id,quantity) values($1,$2,$3) on conflict(cart_id,product_id) do update set quantity=public.cart_items.quantity+excluded.quantity,updated_at=now() returning quantity", [cart.rows[0].id, data.productId, quantity]);
    if (item.rows[0].quantity > product.rows[0].stock) fail("La quantité demandée dépasse le stock disponible.");
    await client.query("commit");
    return { ok: true };
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally { client.release(); }
});

export const updateCartItem = createServerFn({ method: "POST" }).validator((data) => data).handler(async ({ data }) => {
  const user = await ensureCustomer(data.token);
  const quantity = Math.max(1, Math.min(99, Number(data.quantity) || 1));
  const db = await getDb();
  const result = await db.query(
    "update public.cart_items ci set quantity=$3,updated_at=now() from public.carts c,public.products p where ci.id=$1 and ci.cart_id=c.id and c.user_id=$2 and ci.product_id=p.id and p.stock >= $3 and p.is_active=true returning ci.id",
    [data.itemId, user.id, quantity],
  );
  if (!result.rowCount) fail("Quantité indisponible ou article introuvable.");
  return { ok: true };
});

export const removeCartItem = createServerFn({ method: "POST" }).validator((data) => data).handler(async ({ data }) => {
  const user = await ensureCustomer(data.token);
  await (await getDb()).query("delete from public.cart_items ci using public.carts c where ci.id=$1 and ci.cart_id=c.id and c.user_id=$2", [data.itemId, user.id]);
  return { ok: true };
});

export const checkout = createServerFn({ method: "POST" }).validator((data) => data).handler(async ({ data }) => {
  const user = await ensureCustomer(data.token);
  if (data.paymentMethod !== "cash_on_delivery") fail("Seul le paiement à la livraison est actuellement activé.");
  const db = await getDb();
  let address = data.address || {};
  if (data.addressId) {
    const saved = await db.query("select recipient_name,phone,address_line,department,city,area,landmark,delivery_instructions from public.addresses where id=$1 and user_id=$2", [data.addressId,user.id]);
    if (!saved.rowCount) fail("Adresse de livraison introuvable.");
    const a=saved.rows[0];
    address={recipientName:a.recipient_name,phone:a.phone,addressLine:a.address_line,department:a.department,city:a.city,area:a.area,landmark:a.landmark,instructions:a.delivery_instructions};
  }
  const required = ["recipientName","phone","addressLine","city"];
  if (required.some((key) => !clean(address[key], 180))) fail("Complétez le nom, le téléphone, l'adresse et la ville.");
  const client = await db.connect();
  const idem = clean(data.idempotencyKey, 100) || crypto.randomUUID();
  try {
    await client.query("begin");
    const prior = await client.query("select id,order_number from public.orders where idempotency_key=$1 and customer_id=$2", [idem,user.id]);
    if (prior.rowCount) { await client.query("commit"); return { id: prior.rows[0].id, orderNumber: prior.rows[0].order_number }; }
    const cart = await client.query("select id from public.carts where user_id=$1 and status='active' for update", [user.id]);
    if (!cart.rowCount) fail("Votre panier est vide.");
    const items = await client.query(
      "select ci.product_id,ci.quantity,p.name,p.sku,p.price,p.stock from public.cart_items ci join public.products p on p.id=ci.product_id where ci.cart_id=$1 and p.is_active=true and p.deleted_at is null for update of p",
      [cart.rows[0].id],
    );
    if (!items.rowCount) fail("Votre panier est vide ou contient des produits indisponibles.");
    let subtotal = 0;
    if (promotion.coupon) await client.query("insert into public.coupon_redemptions(coupon_id,order_id,customer_id,discount_amount) values($1,$2,$3,$4)", [promotion.coupon.id,order.rows[0].id,user.id,promotion.discount]);
    for (const item of items.rows) {
      if (item.stock < item.quantity) fail("Stock insuffisant pour : " + item.name);
      subtotal += Number(item.price) * item.quantity;
    }
    const zone = await client.query(
      "select z.id,r.fee,r.free_from from public.delivery_zones z join public.delivery_rates r on r.zone_id=z.id and r.is_active=true where z.is_active=true and lower(z.city)=lower($1) and (z.area is null or lower(z.area)=lower($2)) order by (z.area is not null) desc limit 1",
      [clean(address.city,100), clean(address.area,100)],
    );
    if (!zone.rowCount) fail("La livraison n'est pas encore configurée pour cette zone. Contactez Lama Market.");
    const deliveryFee = zone.rows[0].free_from !== null && subtotal >= Number(zone.rows[0].free_from) ? 0 : Number(zone.rows[0].fee);
    const promotion = await couponDiscount(client,data.couponCode,user.id,subtotal,true);
    const total = subtotal + deliveryFee - promotion.discount;
    const orderNumber = "LM-" + new Date().toISOString().slice(0,10).replaceAll("-","") + "-" + crypto.randomUUID().slice(0,8).toUpperCase();
    const snapshot = {
      recipientName: clean(address.recipientName,180), phone: clean(address.phone,40),
      addressLine: clean(address.addressLine,250), city: clean(address.city,100),
      area: clean(address.area,100), landmark: clean(address.landmark,180),
      instructions: clean(address.instructions,500),
    };
    const order = await client.query(
      "insert into public.orders(order_number,customer_id,status,payment_status,delivery_status,subtotal,discount_total,delivery_fee,total,address_snapshot,customer_note,idempotency_key,confirmed_at) values($1,$2,'confirmed','cash_due','unassigned',$3,$4,$5,$6,$7,$8,$9,now()) returning id",
      [orderNumber,user.id,subtotal,promotion.discount,deliveryFee,total,snapshot,clean(data.note,500)||null,idem],
    );
    for (const item of items.rows) {
      const changed = await client.query("update public.products set stock=stock-$2,updated_at=now() where id=$1 and stock >= $2 returning id", [item.product_id,item.quantity]);
      if (!changed.rowCount) fail("Le stock a changé. Actualisez votre panier.");
      const line = await client.query("insert into public.order_items(order_id,product_id,product_name,product_sku,unit_price,quantity,line_total) values($1,$2,$3,$4,$5,$6,$7) returning id", [order.rows[0].id,item.product_id,item.name,item.sku,item.price,item.quantity,Number(item.price)*item.quantity]);
      await client.query("insert into public.stock_reservations(order_item_id,product_id,quantity,status,expires_at) values($1,$2,$3,'reserved',now()+interval '48 hours')", [line.rows[0].id,item.product_id,item.quantity]);
      await client.query("insert into public.stock_movements(product_id,quantity_delta,movement_type,reference_type,reference_id,note,created_by) values($1,$2,'sale','order',$3,'Réservation au checkout',$4)", [item.product_id,-item.quantity,order.rows[0].id,user.id]);
    }
    await client.query("insert into public.payments(order_id,method,amount,status,idempotency_key) values($1,'cash_on_delivery',$2,'pending',$3)", [order.rows[0].id,total,"pay-"+idem]);
    await client.query("insert into public.deliveries(order_id,zone_id,fee,status) values($1,$2,$3,'unassigned')", [order.rows[0].id,zone.rows[0].id,deliveryFee]);
    await client.query("insert into public.order_status_history(order_id,new_status,note,actor_id) values($1,'confirmed','Commande créée par le client',$2)", [order.rows[0].id,user.id]);
    await client.query("insert into public.notifications(user_id,type,title,message,data) values($1,'order_created','Commande reçue',$2,$3)", [user.id,"Votre commande "+orderNumber+" a été enregistrée.",{orderId:order.rows[0].id,orderNumber}]);
    await client.query("delete from public.cart_items where cart_id=$1", [cart.rows[0].id]);
    await client.query("update public.carts set status='converted',updated_at=now() where id=$1", [cart.rows[0].id]);
    await client.query("commit");
    return { id: order.rows[0].id, orderNumber };
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally { client.release(); }
});

export const getMyOrders = createServerFn({ method: "GET" }).validator((data) => data).handler(async ({ data }) => {
  const user = await ensureCustomer(data.token);
  const db = await getDb();
  const result = await db.query(
    "select o.id,o.order_number,o.status,o.payment_status,o.delivery_status,o.subtotal,o.delivery_fee,o.total,o.currency,o.created_at,coalesce(json_agg(json_build_object('name',oi.product_name,'quantity',oi.quantity,'price',oi.unit_price)) filter(where oi.id is not null),'[]') items from public.orders o left join public.order_items oi on oi.order_id=o.id where o.customer_id=$1 group by o.id order by o.created_at desc",
    [user.id],
  );
  return result.rows;
});

export const getAdminDashboard = createServerFn({ method: "GET" }).validator((data) => data).handler(async ({ data }) => {
  await requireRole(data.token, ["admin"]);
  const db = await getDb();
  const [stats, orders, lowStock, couriers, products] = await Promise.all([
    db.query("select count(*)::int total_orders,count(*) filter(where status in ('pending','confirmed','preparing','ready_for_delivery'))::int active_orders,coalesce(sum(total) filter(where payment_status in ('paid','cash_collected')),0)::numeric(12,2) revenue from public.orders"),
    db.query("select id,order_number,status,payment_status,delivery_status,total,created_at from public.orders order by created_at desc limit 12"),
    db.query("select id,name,stock,low_stock_threshold from public.products where is_active=true and stock<=low_stock_threshold order by stock asc limit 20"),
    db.query("select up.user_id,up.display_name,up.phone,up.employment_type,up.is_active from public.courier_profiles up order by up.display_name"),
    db.query("select p.id,p.name,p.description,p.category,p.price,p.old_price,p.discount_ends_at,p.stock,p.is_active,p.image_url,p.sku,p.slug,p.low_stock_threshold,coalesce((select json_agg(json_build_object('id',pi.id,'storage_key',pi.storage_key,'alt_text',pi.alt_text,'is_primary',pi.is_primary,'sort_order',pi.sort_order) order by pi.is_primary desc,pi.sort_order,pi.created_at) from public.product_images pi where pi.product_id=p.id),'[]'::json) images from public.products p where p.deleted_at is null order by p.created_at desc limit 100"),
  ]);
  return { stats: stats.rows[0], orders: orders.rows, lowStock: lowStock.rows, couriers: couriers.rows, products: products.rows };
});

export const adminCreateProduct = createServerFn({ method: "POST" }).validator((data) => data).handler(async ({ data }) => {
  const admin = await requireRole(data.token, ["admin"]);
  const name = clean(data.name,180), category = clean(data.category,80), price = Number(data.price), stock = Math.max(0,Math.floor(Number(data.stock)||0));
  if (!name || !category || !Number.isFinite(price) || price < 0) fail("Nom, catégorie et prix valides requis.");
  const db = await getDb();
  const result = await db.query("insert into public.products(name,description,category,price,old_price,stock,image_url,is_active,sku,low_stock_threshold,sort_order) values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,0) returning id", [name,clean(data.description,2000)||null,category,price,data.oldPrice?Number(data.oldPrice):null,stock,clean(data.imageUrl,1000)||null,data.isActive===true,clean(data.sku,80)||null,Math.max(0,Number(data.lowStockThreshold)||5)]);
  if (stock > 0) await db.query("insert into public.stock_movements(product_id,quantity_delta,movement_type,note,created_by) values($1,$2,'initial','Stock initial',$3)",[result.rows[0].id,stock,admin.id]);
  if (data.imageKey) await db.query("insert into public.product_images(product_id,storage_key,alt_text,is_primary) values($1,$2,$3,true)",[result.rows[0].id,clean(data.imageKey,1024),name]);
  return { id: result.rows[0].id };
});

export const adminAdjustStock = createServerFn({ method: "POST" }).validator((data) => data).handler(async ({ data }) => {
  const admin = await requireRole(data.token, ["admin"]);
  const delta = Math.trunc(Number(data.delta));
  if (!Number.isInteger(delta) || delta === 0) fail("Le mouvement doit être un entier non nul.");
  const db = await getDb();
  const client = await db.connect();
  try {
    await client.query("begin");
    const p = await client.query("update public.products set stock=stock+$2,updated_at=now() where id=$1 and stock+$2>=0 returning stock",[data.productId,delta]);
    if (!p.rowCount) fail("Produit introuvable ou stock négatif interdit.");
    await client.query("insert into public.stock_movements(product_id,quantity_delta,movement_type,note,created_by) values($1,$2,'adjustment',$3,$4)",[data.productId,delta,clean(data.note,300)||"Ajustement manuel",admin.id]);
    await client.query("commit");
    return { stock: p.rows[0].stock };
  } catch(e) { await client.query("rollback"); throw e; } finally { client.release(); }
});

export const adminCreateDeliveryZone = createServerFn({ method: "POST" }).validator((data) => data).handler(async ({ data }) => {
  await requireRole(data.token, ["admin"]);
  const city=clean(data.city,100), name=clean(data.name,100), fee=Number(data.fee);
  if(!city||!name||!Number.isFinite(fee)||fee<0) fail("Nom, ville et tarif valides requis.");
  const db=await getDb();
  const zone=await db.query("insert into public.delivery_zones(name,city,area,estimated_min_days,estimated_max_days) values($1,$2,$3,$4,$5) returning id",[name,city,clean(data.area,100)||null,Math.max(0,Number(data.minDays)||1),Math.max(1,Number(data.maxDays)||3)]);
  await db.query("insert into public.delivery_rates(zone_id,fee,free_from) values($1,$2,$3)",[zone.rows[0].id,fee,data.freeFrom?Number(data.freeFrom):null]);
  return { id:zone.rows[0].id };
});

export const adminAssignCourier = createServerFn({ method: "POST" }).validator((data) => data).handler(async ({ data }) => {
  const admin=await requireRole(data.token,["admin"]);
  const db=await getDb();
  const client=await db.connect();
  try {
    await client.query("begin");
    const courier=await client.query("select user_id from public.courier_profiles where user_id=$1 and is_active=true for update",[data.courierId]);
    if(!courier.rowCount) fail("Livreur actif introuvable.");
    const assigned=await client.query("update public.deliveries set courier_id=$2,assigned_by=$3,status='assigned',assigned_at=now(),updated_at=now() where id=$1 and status in ('unassigned','failed') returning order_id",[data.deliveryId,data.courierId,admin.id]);
    if(!assigned.rowCount) fail("Livraison introuvable ou déjà attribuée.");
    await client.query("update public.orders set delivery_status='assigned',updated_at=now() where id=$1",[assigned.rows[0].order_id]);
    await client.query("insert into public.delivery_events(delivery_id,status,note,actor_id) values($1,'assigned','Livreur affecté',$2)",[data.deliveryId,admin.id]);
    await client.query("insert into public.notifications(user_id,type,title,message,data) values($1,'delivery_assigned','Nouvelle livraison','Une livraison vous a été attribuée.',$2)",[data.courierId,{deliveryId:data.deliveryId}]);
    await client.query("commit");
    return {ok:true};
  } catch(e){await client.query("rollback");throw e;}finally{client.release();}
});

export const getCourierDeliveries = createServerFn({ method: "GET" }).validator((data) => data).handler(async ({ data }) => {
  const courier=await requireRole(data.token,["courier"]);
  const db=await getDb();
  const result=await db.query("select d.id,d.status,d.fee,d.scheduled_at,d.recipient_name,d.proof_url,d.failure_reason,d.courier_note,o.id order_id,o.order_number,o.total,o.payment_status,o.address_snapshot,o.customer_note from public.deliveries d join public.orders o on o.id=d.order_id where d.courier_id=$1 order by d.created_at desc",[courier.id]);
  return result.rows;
});

export const courierUpdateDelivery = createServerFn({ method: "POST" }).validator((data) => data).handler(async ({ data }) => {
  const courier=await requireRole(data.token,["courier"]);
  const allowed=["preparing","in_transit","delivered","failed","returned"];
  if(!allowed.includes(data.status)) fail("Statut de livraison invalide.");
  const db=await getDb();
  const client=await db.connect();
  try{
    await client.query("begin");
    const delivery=await client.query("select d.id,d.order_id,d.status,o.payment_status from public.deliveries d join public.orders o on o.id=d.order_id where d.id=$1 and d.courier_id=$2 for update",[data.deliveryId,courier.id]);
    if(!delivery.rowCount) fail("Livraison introuvable.");
    const transitions = { assigned:["preparing","in_transit","failed"], preparing:["in_transit","failed"], in_transit:["delivered","failed"], failed:["in_transit","returned"], returned:[], delivered:[] };
    if (!(transitions[delivery.rows[0].status] || []).includes(data.status)) fail("Cette transition de livraison n'est pas autorisée.");
    if (data.status === "failed" && !clean(data.failureReason,500)) fail("Indiquez la raison de l'échec de livraison.");
    if (data.status === "returned" && !clean(data.note,500)) fail("Ajoutez une note expliquant le retour.");
    const proofKey = clean(data.proofUrl,1024);
    if (proofKey && !proofKey.startsWith("delivery-proofs/")) fail("La preuve doit provenir du stockage sécurisé des livraisons.");
    if (data.status === "delivered" && delivery.rows[0].payment_status === "cash_due" && data.cashCollected !== true) fail("Confirmez la réception du paiement en espèces avant de clôturer cette livraison.");
    await client.query("update public.deliveries set status=$2,picked_up_at=case when $2='in_transit' then now() else picked_up_at end,delivered_at=case when $2='delivered' then now() else delivered_at end,recipient_name=$3,proof_url=$4,failure_reason=$5,courier_note=$6,updated_at=now() where id=$1",[data.deliveryId,data.status,clean(data.recipientName,120)||null,proofKey||null,clean(data.failureReason,500)||null,clean(data.note,500)||null]);
    await client.query("update public.orders set delivery_status=$2,updated_at=now() where id=$1",[delivery.rows[0].order_id,data.status]);
    await client.query("insert into public.delivery_events(delivery_id,status,note,proof_url,actor_id) values($1,$2,$3,$4,$5)",[data.deliveryId,data.status,clean(data.note,500)||null,proofKey||null,courier.id]);
    if(data.status==="delivered"){
      if(data.cashCollected===true){
        await client.query("update public.payments set status='cash_collected',paid_at=now(),updated_at=now() where order_id=$1 and method='cash_on_delivery'",[delivery.rows[0].order_id]);
        await client.query("update public.orders set payment_status='cash_collected' where id=$1",[delivery.rows[0].order_id]);
      }
      await client.query("update public.orders set status='completed',completed_at=now(),updated_at=now() where id=$1 and payment_status in ('paid','cash_collected')",[delivery.rows[0].order_id]);
      await client.query("update public.stock_reservations set status='consumed',consumed_at=now() where order_item_id in(select id from public.order_items where order_id=$1) and status='reserved'",[delivery.rows[0].order_id]);
    }
    await client.query("insert into public.notifications(user_id,type,title,message,data) select customer_id,'delivery_update','Mise à jour de livraison',$2,$3 from public.orders where id=$1",[delivery.rows[0].order_id,"Votre livraison est maintenant : "+data.status,{orderId:delivery.rows[0].order_id}]);
    await client.query("commit");
    return {ok:true};
  }catch(e){await client.query("rollback");throw e;}finally{client.release();}
});

export const getMyNotifications = createServerFn({ method: "GET" }).validator((data) => data).handler(async ({ data }) => {
  const user=await requireUser(data.token);
  const db=await getDb();
  const result=await db.query("select id,type,title,message,data,read_at,created_at from public.notifications where user_id=$1 order by created_at desc limit 50",[user.id]);
  return result.rows;
});

export const getAdminReports = createServerFn({ method: "GET" }).validator((data) => data).handler(async ({ data }) => {
  await requireRole(data.token,["admin"]);
  const db=await getDb();
  const [daily,top]=await Promise.all([
    db.query("select date_trunc('day',created_at)::date day,count(*)::int orders,coalesce(sum(total),0)::numeric(12,2) sales from public.orders where created_at>=now()-interval '30 days' and payment_status in ('paid','cash_collected') and status<>'cancelled' group by 1 order by 1"),
    db.query("select oi.product_name,sum(oi.quantity)::int quantity,sum(oi.line_total)::numeric(12,2) sales from public.order_items oi join public.orders o on o.id=oi.order_id where o.status<>'cancelled' group by oi.product_name order by quantity desc limit 10"),
  ]);
  return {daily:daily.rows,topProducts:top.rows};
});


export const adminCreateCourier = createServerFn({ method: "POST" }).validator((data) => data).handler(async ({ data }) => {
  const admin = await requireRole(data.token, ["admin"]);
  const db = await getDb();
  const email = clean(data.email, 254).toLowerCase();
  const phone = clean(data.phone, 40);
  const displayName = clean(data.displayName, 120);
  if (!email || !phone || !displayName) fail("E-mail, nom et téléphone du livreur sont requis.");
  const found = await db.query('select id from neon_auth."user" where lower(email)=lower($1) limit 1', [email]);
  if (!found.rowCount) fail("Ce compte doit d'abord être créé par son titulaire dans Lama Market.");
  const userId = found.rows[0].id;
  await db.query("insert into public.user_roles(user_id,role,created_by) values($1,'courier',$2) on conflict(user_id,role) do update set is_active=true", [userId, admin.id]);
  await db.query("insert into public.courier_profiles(user_id,phone,display_name,employment_type,is_active) values($1,$2,$3,$4,true) on conflict(user_id) do update set phone=excluded.phone,display_name=excluded.display_name,employment_type=excluded.employment_type,is_active=true,updated_at=now()", [userId, phone, displayName, data.employmentType === "employee" ? "employee" : "mandated"]);
  return { ok: true, userId };
});

export const adminUpdateOrderStatus = createServerFn({ method: "POST" }).validator((data) => data).handler(async ({ data }) => {
  const admin = await requireRole(data.token, ["admin"]);
  const allowed = ["confirmed","preparing","ready_for_delivery","completed","cancelled"];
  if (!allowed.includes(data.status)) fail("Statut de commande invalide.");
  const db = await getDb();
  const client = await db.connect();
  try {
    await client.query("begin");
    const order = await client.query("select id,customer_id,status,delivery_status,payment_status from public.orders where id=$1 for update", [data.orderId]);
    if (!order.rowCount) fail("Commande introuvable.");
    if (data.status === "completed" && (order.rows[0].delivery_status !== "delivered" || !["paid","cash_collected"].includes(order.rows[0].payment_status))) fail("Une commande ne peut être terminée qu'après livraison et règlement confirmé.");
    if (data.status === "cancelled") {
      const reservations = await client.query("select product_id,quantity from public.stock_reservations where order_item_id in(select id from public.order_items where order_id=$1) and status='reserved' for update", [data.orderId]);
      for (const reservation of reservations.rows) {
        await client.query("update public.products set stock=stock+$2,updated_at=now() where id=$1", [reservation.product_id,reservation.quantity]);
        await client.query("insert into public.stock_movements(product_id,quantity_delta,movement_type,reference_type,reference_id,note,created_by) values($1,$2,'reservation_release','order',$3,'Libération après annulation',$4)", [reservation.product_id,reservation.quantity,data.orderId,admin.id]);
      }
      await client.query("update public.stock_reservations set status='released',released_at=now() where order_item_id in(select id from public.order_items where order_id=$1) and status='reserved'", [data.orderId]);
      await client.query("update public.deliveries set status='returned',updated_at=now() where order_id=$1 and status not in('delivered','returned')", [data.orderId]);
      await client.query("update public.orders set cancelled_at=now(),updated_at=now() where id=$1", [data.orderId]);
    }
    await client.query("update public.orders set status=$2,updated_at=now() where id=$1", [data.orderId,data.status]);
    await client.query("insert into public.order_status_history(order_id,previous_status,new_status,note,actor_id) values($1,$2,$3,$4,$5)", [data.orderId,order.rows[0].status,data.status,clean(data.note,500)||null,admin.id]);
    await client.query("insert into public.notifications(user_id,type,title,message,data) values($1,'order_update','Mise à jour de commande',$2,$3)", [order.rows[0].customer_id,"Votre commande est maintenant : "+data.status,{orderId:data.orderId}]);
    await client.query("commit");
    return {ok:true};
  } catch(e) { await client.query("rollback"); throw e; } finally { client.release(); }
});

export const getAdminDeliveries = createServerFn({ method: "GET" }).validator((data) => data).handler(async ({ data }) => {
  await requireRole(data.token, ["admin"]);
  const db = await getDb();
  const result = await db.query("select d.id,d.status,d.fee,d.scheduled_at,d.proof_url,d.failure_reason,d.courier_note,o.id order_id,o.order_number,o.total,o.payment_status,o.address_snapshot,o.customer_id,cp.display_name courier_name,cp.user_id courier_id from public.deliveries d join public.orders o on o.id=d.order_id left join public.courier_profiles cp on cp.user_id=d.courier_id order by d.created_at desc limit 50");
  return result.rows;
});


export const getStorefrontSettings = createServerFn({ method: "GET" }).handler(async () => {
  const db = await getDb();
  const result = await db.query("select value from public.store_settings where key='hero_cover_url' limit 1");
  const value = result.rows[0]?.value;
  return { heroCoverUrl: typeof value === "string" ? value : value?.url ?? null };
});

export const getCoverImageUploadUrl = createServerFn({ method: "POST" }).validator((data) => data).handler(async ({ data }) => {
  await requireRole(data.token, ["admin"]);
  const storage = await import("./storage.server");
  return storage.createCoverUpload({ contentType: data.contentType, size: Number(data.size) });
});

export const saveStorefrontCover = createServerFn({ method: "POST" }).validator((data) => data).handler(async ({ data }) => {
  const admin = await requireRole(data.token, ["admin"]);
  const endpoint = process.env.AWS_ENDPOINT_URL_S3?.replace(/\/$/, "");
  const publicUrl = clean(data.publicUrl, 2000);
  const allowedPrefix = endpoint ? `${endpoint}/product-images/site/covers/` : "";
  if (!allowedPrefix || !publicUrl.startsWith(allowedPrefix) || !publicUrl.endsWith(".gif")) {
    fail("L'adresse de la couverture GIF n'est pas valide.");
  }
  const db = await getDb();
  await db.query(
    "insert into public.store_settings(key,value,updated_by,updated_at) values('hero_cover_url',to_jsonb($2::text),$1,now()) on conflict(key) do update set value=excluded.value,updated_by=excluded.updated_by,updated_at=now()",
    [admin.id, publicUrl],
  );
  return { ok: true, heroCoverUrl: publicUrl };
});


export const getProductImageUploadUrl = createServerFn({ method: "POST" }).validator((data) => data).handler(async ({ data }) => {
  await requireRole(data.token, ["admin"]);
  const storage = await import("./storage.server");
  return storage.createProductUpload({ contentType: data.contentType, size: Number(data.size) });
});


export const adminUpdateProduct = createServerFn({ method: "POST" }).validator((data) => data).handler(async ({ data }) => {
  await requireRole(data.token, ["admin"]);
  const name=clean(data.name,180), category=clean(data.category,80), price=Number(data.price);
  if(!name||!category||!Number.isFinite(price)||price<0) fail("Nom, catégorie et prix valides requis.");
  const db=await getDb();
  const oldPrice = data.oldPrice === "" || data.oldPrice == null ? null : Number(data.oldPrice);
  if (oldPrice !== null && (!Number.isFinite(oldPrice) || oldPrice < price)) fail("Le prix normal doit être supérieur ou égal au prix actuel.");
  const discountEndsAt = data.discountEndsAt ? new Date(data.discountEndsAt) : null;
  if (discountEndsAt && Number.isNaN(discountEndsAt.getTime())) fail("Date de fin promotionnelle invalide.");
  const result=await db.query("update public.products set name=$2,description=$3,category=$4,price=$5,old_price=$6,discount_ends_at=$7,image_url=$8,is_active=$9,low_stock_threshold=$10,updated_at=now() where id=$1 and deleted_at is null returning id",[data.productId,name,clean(data.description,2000)||null,category,price,oldPrice,discountEndsAt,clean(data.imageUrl,1000)||null,data.isActive===true,Math.max(0,Number(data.lowStockThreshold)||5)]);
  if(!result.rowCount) fail("Produit introuvable.");
  return {ok:true};
});

export const adminArchiveProduct = createServerFn({ method: "POST" }).validator((data) => data).handler(async ({ data }) => {
  await requireRole(data.token, ["admin"]);
  const db=await getDb();
  const result=await db.query("update public.products set is_active=false,deleted_at=now(),updated_at=now() where id=$1 and deleted_at is null returning id",[data.productId]);
  if(!result.rowCount) fail("Produit introuvable.");
  return {ok:true};
});

export const markNotificationRead = createServerFn({ method: "POST" }).validator((data) => data).handler(async ({ data }) => {
  const user=await requireUser(data.token);
  await (await getDb()).query("update public.notifications set read_at=now() where id=$1 and user_id=$2",[data.notificationId,user.id]);
  return {ok:true};
});


// Internal employees of the single Lama Market store. These are not marketplace sellers.
async function requireStoreStaff(token, allowed = []) {
  const user = await requireUser(token);
  const db = await getDb();
  const admin = await db.query("select 1 from public.user_roles where user_id=$1 and role='admin' and is_active=true", [user.id]);
  if (admin.rowCount) return { ...user, staffRole: "admin" };
  const result = await db.query("select staff_role from public.staff_members where user_id=$1 and is_active=true", [user.id]);
  if (!result.rowCount) fail("Accès réservé à l'équipe de Lama Market.", 403);
  const staffRole = result.rows[0].staff_role;
  if (allowed.length && !allowed.includes(staffRole)) fail("Cette action ne fait pas partie de vos responsabilités.", 403);
  return { ...user, staffRole };
}

export const getStaffWorkspace = createServerFn({ method: "GET" }).validator((data) => data).handler(async ({ data }) => {
  const staff = await requireStoreStaff(data.token);
  const db = await getDb();
  const canSeeOrders = ["admin","manager","cashier","fulfillment"].includes(staff.staffRole);
  const canSeePayments = ["admin","manager","cashier"].includes(staff.staffRole);
  const canSeeProducts = ["admin","manager","inventory"].includes(staff.staffRole);
  const [orders, products, payments, profile] = await Promise.all([
    canSeeOrders
      ? db.query("select o.id,o.order_number,o.status,o.payment_status,o.delivery_status,o.total,o.created_at,coalesce(json_agg(json_build_object('name',oi.product_name,'quantity',oi.quantity)) filter(where oi.id is not null),'[]') items from public.orders o left join public.order_items oi on oi.order_id=o.id where o.status not in ('completed','cancelled') group by o.id order by o.created_at asc limit 40")
      : Promise.resolve({ rows: [] }),
    canSeeProducts
      ? db.query("select id,name,sku,stock,low_stock_threshold,is_active from public.products where deleted_at is null order by name limit 150")
      : Promise.resolve({ rows: [] }),
    canSeePayments
      ? db.query("select p.id,p.method,p.amount,p.status,p.external_reference,p.created_at,o.order_number from public.payments p join public.orders o on o.id=p.order_id order by p.created_at desc limit 30")
      : Promise.resolve({ rows: [] }),
    db.query('select display_name,staff_role,phone from public.staff_members where user_id=$1', [staff.id]),
  ]);
  return { staffRole: staff.staffRole, profile: profile.rows[0] || null, orders: orders.rows, products: products.rows, payments: payments.rows };
});

export const adminListStaff = createServerFn({ method: "GET" }).validator((data) => data).handler(async ({ data }) => {
  await requireRole(data.token, ["admin"]);
  const db = await getDb();
  const result = await db.query('select s.user_id,s.display_name,s.phone,s.staff_role,s.is_active,u.email from public.staff_members s join neon_auth."user" u on u.id=s.user_id order by s.created_at');
  return result.rows;
});

export const adminAddStaff = createServerFn({ method: "POST" }).validator((data) => data).handler(async ({ data }) => {
  const admin = await requireRole(data.token, ["admin"]);
  const email = clean(data.email, 254).toLowerCase();
  const displayName = clean(data.displayName, 120);
  const role = clean(data.staffRole, 30);
  if (!email || !displayName || !["manager","cashier","inventory","fulfillment"].includes(role)) fail("E-mail, nom et fonction valides requis.");
  const db = await getDb();
  const found = await db.query('select id from neon_auth."user" where lower(email)=lower($1) limit 1', [email]);
  if (!found.rowCount) fail("La personne doit d'abord créer son compte Lama Market.");
  await db.query("insert into public.staff_members(user_id,display_name,phone,staff_role,created_by,is_active) values($1,$2,$3,$4,$5,true) on conflict(user_id) do update set display_name=excluded.display_name,phone=excluded.phone,staff_role=excluded.staff_role,is_active=true,updated_at=now()", [found.rows[0].id, displayName, clean(data.phone,40)||null, role, admin.id]);
  return { ok: true };
});

export const adminUpdateStaff = createServerFn({ method: "POST" }).validator((data) => data).handler(async ({ data }) => {
  await requireRole(data.token, ["admin"]);
  const role = clean(data.staffRole, 30);
  if (!["manager","cashier","inventory","fulfillment"].includes(role)) fail("Fonction invalide.");
  const result = await (await getDb()).query("update public.staff_members set staff_role=$2,is_active=$3,updated_at=now() where user_id=$1 returning user_id", [data.userId, role, data.isActive === true]);
  if (!result.rowCount) fail("Employé introuvable.");
  return { ok: true };
});

export const staffUpdateOrderStatus = createServerFn({ method: "POST" }).validator((data) => data).handler(async ({ data }) => {
  const staff = await requireStoreStaff(data.token, ["admin","manager","fulfillment"]);
  const allowed = ["confirmed","preparing","ready_for_delivery"];
  if (!allowed.includes(data.status)) fail("Statut de commande invalide.");
  const db = await getDb();
  const client = await db.connect();
  try {
    await client.query("begin");
    const order = await client.query("select id,customer_id,status from public.orders where id=$1 for update", [data.orderId]);
    if (!order.rowCount) fail("Commande introuvable.");
    const transitions = { confirmed:["preparing"], preparing:["ready_for_delivery"], ready_for_delivery:[] };
    if (!(transitions[order.rows[0].status] || []).includes(data.status)) fail("Cette étape a déjà été traitée ou n'est pas autorisée.");
    await client.query("update public.orders set status=$2,updated_at=now() where id=$1", [data.orderId,data.status]);
    await client.query("insert into public.order_status_history(order_id,previous_status,new_status,note,actor_id) values($1,$2,$3,$4,$5)", [data.orderId,order.rows[0].status,data.status,clean(data.note,300)||"Mise à jour par l'équipe boutique",staff.id]);
    await client.query("insert into public.notifications(user_id,type,title,message,data) values($1,'order_update','Mise à jour de commande',$2,$3)", [order.rows[0].customer_id,"Votre commande est maintenant : "+data.status,{orderId:data.orderId}]);
    await client.query("commit");
    return { ok: true };
  } catch (error) { await client.query("rollback"); throw error; } finally { client.release(); }
});

export const staffAdjustStock = createServerFn({ method: "POST" }).validator((data) => data).handler(async ({ data }) => {
  const staff = await requireStoreStaff(data.token, ["admin","manager","inventory"]);
  const delta = Math.trunc(Number(data.delta));
  if (!Number.isInteger(delta) || delta === 0) fail("Saisissez une quantité entière non nulle.");
  const db = await getDb();
  const client = await db.connect();
  try {
    await client.query("begin");
    const updated = await client.query("update public.products set stock=stock+$2,updated_at=now() where id=$1 and stock+$2>=0 and deleted_at is null returning stock", [data.productId,delta]);
    if (!updated.rowCount) fail("Produit introuvable ou stock négatif interdit.");
    await client.query("insert into public.stock_movements(product_id,quantity_delta,movement_type,note,created_by) values($1,$2,'adjustment',$3,$4)", [data.productId,delta,clean(data.note,300)||"Mouvement saisi par l'équipe",staff.id]);
    await client.query("commit");
    return { stock: updated.rows[0].stock };
  } catch (error) { await client.query("rollback"); throw error; } finally { client.release(); }
});


// Resolve the correct workspace after authentication using server-verified roles.
export const getMyAccessContext = createServerFn({ method: "GET" }).validator((data) => data).handler(async ({ data }) => {
  const user = await requireUser(data.token);
  const db = await getDb();
  const identity = await db.query('select email from neon_auth."user" where id=$1', [user.id]);
  const adminEmail = process.env.LAMA_MARKET_ADMIN_EMAIL?.trim().toLowerCase();
  if (identity.rows[0]?.email && adminEmail && identity.rows[0].email.toLowerCase() === adminEmail) {
    await db.query("insert into public.user_roles(user_id,role,is_active) values($1,'admin',true) on conflict(user_id,role) do update set is_active=true", [user.id]);
  }
  const [roles, staff, courier] = await Promise.all([
    db.query("select role from public.user_roles where user_id=$1 and is_active=true", [user.id]),
    db.query("select staff_role from public.staff_members where user_id=$1 and is_active=true", [user.id]),
    db.query("select is_active from public.courier_profiles where user_id=$1", [user.id]),
  ]);
  const roleSet = new Set(roles.rows.map(row => row.role));
  if (roleSet.has("admin")) return { destination: "/admin", primaryRole: "admin" };
  if (staff.rowCount) return { destination: "/equipe", primaryRole: staff.rows[0].staff_role };
  if (courier.rows[0]?.is_active && roleSet.has("courier")) return { destination: "/livreur", primaryRole: "courier" };
  return { destination: "/compte", primaryRole: "customer" };
});

function slugifyCategory(value) {
  return clean(value,100).normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"").slice(0,80);
}
async function couponDiscount(q, codeValue, customerId, subtotal, lock=false) {
  const code=clean(codeValue,64).toUpperCase();
  if(!code) return {coupon:null,discount:0};
  const result=await q.query(`select id,code,discount_type,discount_value,minimum_order,max_uses from public.coupons
    where upper(code)=upper($1) and is_active=true and (starts_at is null or starts_at<=now()) and (ends_at is null or ends_at>now()) ${lock?"for update":""}`,[code]);
  if(!result.rowCount) fail("Ce code promotionnel est invalide ou expiré.");
  const coupon=result.rows[0];
  if(subtotal<Number(coupon.minimum_order)) fail("Le montant minimum pour ce code promotionnel n'est pas atteint.");
  const [uses,mine]=await Promise.all([
    q.query("select count(*)::int count from public.coupon_redemptions where coupon_id=$1",[coupon.id]),
    q.query("select count(*)::int count from public.coupon_redemptions where coupon_id=$1 and customer_id=$2",[coupon.id,customerId]),
  ]);
  if(coupon.max_uses!==null && uses.rows[0].count>=coupon.max_uses) fail("Ce code promotionnel a atteint sa limite.");
  if(mine.rows[0].count>0) fail("Ce code promotionnel a déjà été utilisé sur votre compte.");
  const raw=coupon.discount_type==="percent"?subtotal*Number(coupon.discount_value)/100:Number(coupon.discount_value);
  return {coupon,discount:Math.min(subtotal,Math.max(0,Math.round(raw*100)/100))};
}

export const getMyAddresses=createServerFn({method:"GET"}).validator((data)=>data).handler(async({data})=>{
  const user=await requireUser(data.token);
  const r=await (await getDb()).query("select id,recipient_name,phone,address_line,department,city,area,landmark,delivery_instructions,is_default from public.addresses where user_id=$1 order by is_default desc,updated_at desc",[user.id]);
  return r.rows;
});
export const saveMyAddress=createServerFn({method:"POST"}).validator((data)=>data).handler(async({data})=>{
  const user=await requireUser(data.token), db=await getDb();
  const fields=[clean(data.recipientName,160),clean(data.phone,40),clean(data.addressLine,250),clean(data.department,100)||null,clean(data.city,100),clean(data.area,100)||null,clean(data.landmark,180)||null,clean(data.instructions,500)||null];
  if(!fields[0]||!fields[1]||!fields[2]||!fields[4]) fail("Nom, téléphone, adresse et ville sont obligatoires.");
  const client=await db.connect();
  try {
    await client.query("begin");
    if(data.addressId){
      const own=await client.query("select id from public.addresses where id=$1 and user_id=$2 for update",[data.addressId,user.id]);
      if(!own.rowCount) fail("Adresse introuvable.");
    }
    const count=await client.query("select count(*)::int count from public.addresses where user_id=$1",[user.id]);
    const makeDefault=data.isDefault===true||count.rows[0].count===0;
    if(makeDefault) await client.query("update public.addresses set is_default=false,updated_at=now() where user_id=$1",[user.id]);
    let saved;
    if(data.addressId) saved=await client.query("update public.addresses set recipient_name=$3,phone=$4,address_line=$5,department=$6,city=$7,area=$8,landmark=$9,delivery_instructions=$10,is_default=$11,updated_at=now() where id=$2 and user_id=$1 returning id",[user.id,data.addressId,...fields,makeDefault]);
    else saved=await client.query("insert into public.addresses(user_id,recipient_name,phone,address_line,department,city,area,landmark,delivery_instructions,is_default) values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) returning id",[user.id,...fields,makeDefault]);
    await client.query("commit");
    return {id:saved.rows[0].id,isDefault:makeDefault};
  } catch(e){await client.query("rollback");throw e;} finally{client.release();}
});
export const deleteMyAddress=createServerFn({method:"POST"}).validator((data)=>data).handler(async({data})=>{
  const user=await requireUser(data.token),client=await (await getDb()).connect();
  try{
    await client.query("begin");
    const removed=await client.query("delete from public.addresses where id=$1 and user_id=$2 returning is_default",[data.addressId,user.id]);
    if(!removed.rowCount) fail("Adresse introuvable.");
    if(removed.rows[0].is_default) await client.query("update public.addresses set is_default=true,updated_at=now() where id=(select id from public.addresses where user_id=$1 order by updated_at desc limit 1)",[user.id]);
    await client.query("commit");return {ok:true};
  }catch(e){await client.query("rollback");throw e;}finally{client.release();}
});
export const getCheckoutQuote=createServerFn({method:"POST"}).validator((data)=>data).handler(async({data})=>{
  const user=await ensureCustomer(data.token),db=await getDb();
  const cart=await db.query("select ci.quantity,p.price,p.stock,p.name from public.carts c join public.cart_items ci on ci.cart_id=c.id join public.products p on p.id=ci.product_id where c.user_id=$1 and c.status='active' and p.is_active=true and p.deleted_at is null",[user.id]);
  if(!cart.rowCount) fail("Votre panier est vide.");
  let subtotal=0;for(const item of cart.rows){if(Number(item.stock)<Number(item.quantity))fail("Stock insuffisant pour : "+item.name);subtotal+=Number(item.price)*Number(item.quantity);}
  let deliveryFee=null;
  if(clean(data.city,100)){
    const z=await db.query("select r.fee,r.free_from from public.delivery_zones z join public.delivery_rates r on r.zone_id=z.id and r.is_active=true where z.is_active=true and lower(z.city)=lower($1) and (z.area is null or lower(z.area)=lower($2)) order by (z.area is not null) desc limit 1",[clean(data.city,100),clean(data.area,100)]);
    if(z.rowCount) deliveryFee=z.rows[0].free_from!==null&&subtotal>=Number(z.rows[0].free_from)?0:Number(z.rows[0].fee);
  }
  const promo=await couponDiscount(db,data.couponCode,user.id,subtotal,false);
  return {subtotal:Number(subtotal.toFixed(2)),deliveryFee,discount:promo.discount,total:deliveryFee===null?null:Number((subtotal+deliveryFee-promo.discount).toFixed(2)),couponCode:promo.coupon?.code??null};
});
export const adminListCategories=createServerFn({method:"GET"}).validator((data)=>data).handler(async({data})=>{
  await requireRole(data.token,["admin"]);
  return (await getDb()).query("select c.slug,c.name,c.description,c.image_url,c.sort_order,c.is_active,count(p.id)::int product_count from public.categories c left join public.products p on p.category=c.slug and p.deleted_at is null group by c.slug order by c.sort_order,c.name").then(r=>r.rows);
});
export const adminUpsertCategory=createServerFn({method:"POST"}).validator((data)=>data).handler(async({data})=>{
  await requireRole(data.token,["admin"]);
  const name=clean(data.name,100),slug=slugifyCategory(data.slug||name);
  if(!name||!slug) fail("Nom et identifiant de catégorie requis.");
  const args=[slug,name,clean(data.description,500)||null,clean(data.imageUrl,1000)||null,Math.trunc(Number(data.sortOrder)||0),data.isActive!==false];
  const db=await getDb();
  if(data.originalSlug){
    const r=await db.query("update public.categories set slug=$2,name=$3,description=$4,image_url=$5,sort_order=$6,is_active=$7,updated_at=now() where slug=$1 returning slug",[clean(data.originalSlug,80),...args]);
    if(!r.rowCount) fail("Catégorie introuvable.");return {slug:r.rows[0].slug};
  }
  const r=await db.query("insert into public.categories(slug,name,description,image_url,sort_order,is_active) values($1,$2,$3,$4,$5,$6) returning slug",args);
  return {slug:r.rows[0].slug};
});
export const adminArchiveCategory=createServerFn({method:"POST"}).validator((data)=>data).handler(async({data})=>{
  await requireRole(data.token,["admin"]);const db=await getDb();
  const used=await db.query("select count(*)::int count from public.products where category=$1 and is_active=true and deleted_at is null",[clean(data.slug,80)]);
  if(used.rows[0].count>0) fail("Masquez ou déplacez d'abord les produits actifs de cette catégorie.");
  const r=await db.query("update public.categories set is_active=false,updated_at=now() where slug=$1 returning slug",[clean(data.slug,80)]);
  if(!r.rowCount) fail("Catégorie introuvable.");return {ok:true};
});
export const adminListCustomers=createServerFn({method:"GET"}).validator((data)=>data).handler(async({data})=>{
  await requireRole(data.token,["admin"]);
  const r=await (await getDb()).query(`select u.id,u.name,u.email,cp.phone,cp.preferred_name,count(o.id)::int order_count,
    coalesce(sum(o.total) filter(where o.payment_status in ('paid','cash_collected')),0)::numeric(12,2) total_paid,max(o.created_at) last_order_at
    from neon_auth."user" u join public.user_roles ur on ur.user_id=u.id and ur.role='customer' and ur.is_active=true
    left join public.customer_profiles cp on cp.user_id=u.id left join public.orders o on o.customer_id=u.id
    group by u.id,u.name,u.email,cp.phone,cp.preferred_name order by last_order_at desc nulls last,u.name limit 250`);
  return r.rows;
});
export const adminListCoupons=createServerFn({method:"GET"}).validator((data)=>data).handler(async({data})=>{
  await requireRole(data.token,["admin"]);
  const r=await (await getDb()).query("select c.id,c.code,c.discount_type,c.discount_value,c.minimum_order,c.max_uses,c.starts_at,c.ends_at,c.is_active,count(r.id)::int redeemed from public.coupons c left join public.coupon_redemptions r on r.coupon_id=c.id group by c.id order by c.created_at desc");
  return r.rows;
});
export const adminUpsertCoupon=createServerFn({method:"POST"}).validator((data)=>data).handler(async({data})=>{
  await requireRole(data.token,["admin"]);const db=await getDb();
  const code=clean(data.code,64).toUpperCase().replace(/\s+/g,"");
  const type=data.discountType==="percent"?"percent":"fixed",value=Number(data.discountValue),minimum=Math.max(0,Number(data.minimumOrder)||0);
  const max=data.maxUses===""||data.maxUses==null?null:Math.max(1,Math.floor(Number(data.maxUses)));
  if(!/^[A-Z0-9_-]{3,64}$/.test(code)||!Number.isFinite(value)||value<=0||(type==="percent"&&value>100)) fail("Code ou remise invalide.");
  const start=data.startsAt?new Date(data.startsAt):null,end=data.endsAt?new Date(data.endsAt):null;
  if((start&&Number.isNaN(start.getTime()))||(end&&Number.isNaN(end.getTime()))||(start&&end&&end<=start)) fail("Période promotionnelle invalide.");
  const args=[code,type,value,minimum,max,start,end,data.isActive!==false];
  if(data.couponId){const r=await db.query("update public.coupons set code=$2,discount_type=$3,discount_value=$4,minimum_order=$5,max_uses=$6,starts_at=$7,ends_at=$8,is_active=$9,updated_at=now() where id=$1 returning id",[data.couponId,...args]);if(!r.rowCount)fail("Code introuvable.");return {id:r.rows[0].id};}
  const r=await db.query("insert into public.coupons(code,discount_type,discount_value,minimum_order,max_uses,starts_at,ends_at,is_active) values($1,$2,$3,$4,$5,$6,$7,$8) returning id",args);return {id:r.rows[0].id};
});
export const adminArchiveCoupon=createServerFn({method:"POST"}).validator((data)=>data).handler(async({data})=>{
  await requireRole(data.token,["admin"]);const r=await (await getDb()).query("update public.coupons set is_active=false,updated_at=now() where id=$1 returning id",[data.couponId]);if(!r.rowCount)fail("Code introuvable.");return {ok:true};
});

export const adminAddProductImage=createServerFn({method:"POST"}).validator((data)=>data).handler(async({data})=>{
  await requireRole(data.token,["admin"]);
  const key=clean(data.storageKey,1024);if(!key.startsWith("products/"))fail("Fichier image produit invalide.");
  const db=await getDb(),client=await db.connect();
  try{
    await client.query("begin");
    const p=await client.query("select id from public.products where id=$1 and deleted_at is null for update",[data.productId]);
    if(!p.rowCount)fail("Produit introuvable.");
    const count=await client.query("select count(*)::int count from public.product_images where product_id=$1",[data.productId]);
    if(count.rows[0].count>=8)fail("Maximum de 8 images par produit.");
    const primary=data.isPrimary===true||count.rows[0].count===0;
    if(primary)await client.query("update public.product_images set is_primary=false where product_id=$1",[data.productId]);
    const r=await client.query("insert into public.product_images(product_id,storage_key,alt_text,is_primary,sort_order) values($1,$2,$3,$4,$5) returning id",[data.productId,key,clean(data.altText,180)||null,primary,Math.max(0,Math.trunc(Number(data.sortOrder)||0))]);
    const endpoint=process.env.AWS_ENDPOINT_URL_S3?.replace(/\/$/,"");
    if(primary&&endpoint)await client.query("update public.products set image_url=$2,updated_at=now() where id=$1",[data.productId,`${endpoint}/product-images/${key}`]);
    await client.query("commit");return {id:r.rows[0].id,primary};
  }catch(e){await client.query("rollback");throw e;}finally{client.release();}
});
export const adminSetPrimaryProductImage=createServerFn({method:"POST"}).validator((data)=>data).handler(async({data})=>{
  await requireRole(data.token,["admin"]);const db=await getDb(),client=await db.connect();
  try{
    await client.query("begin");
    const r=await client.query("select product_id,storage_key from public.product_images where id=$1 for update",[data.imageId]);if(!r.rowCount)fail("Image introuvable.");
    await client.query("update public.product_images set is_primary=false where product_id=$1",[r.rows[0].product_id]);
    await client.query("update public.product_images set is_primary=true where id=$1",[data.imageId]);
    const endpoint=process.env.AWS_ENDPOINT_URL_S3?.replace(/\/$/,"");
    if(endpoint)await client.query("update public.products set image_url=$2,updated_at=now() where id=$1",[r.rows[0].product_id,`${endpoint}/product-images/${r.rows[0].storage_key}`]);
    await client.query("commit");return {ok:true};
  }catch(e){await client.query("rollback");throw e;}finally{client.release();}
});
export const adminDeleteProductImage=createServerFn({method:"POST"}).validator((data)=>data).handler(async({data})=>{
  await requireRole(data.token,["admin"]);const db=await getDb(),client=await db.connect();
  try{
    await client.query("begin");
    const r=await client.query("select product_id,is_primary from public.product_images where id=$1 for update",[data.imageId]);if(!r.rowCount)fail("Image introuvable.");
    await client.query("delete from public.product_images where id=$1",[data.imageId]);
    if(r.rows[0].is_primary){
      const next=await client.query("select id,storage_key from public.product_images where product_id=$1 order by sort_order,created_at limit 1",[r.rows[0].product_id]);
      const endpoint=process.env.AWS_ENDPOINT_URL_S3?.replace(/\/$/,"");
      if(next.rowCount){
        await client.query("update public.product_images set is_primary=true where id=$1",[next.rows[0].id]);
        if(endpoint)await client.query("update public.products set image_url=$2,updated_at=now() where id=$1",[r.rows[0].product_id,`${endpoint}/product-images/${next.rows[0].storage_key}`]);
      }else await client.query("update public.products set image_url=null,updated_at=now() where id=$1",[r.rows[0].product_id]);
    }
    await client.query("commit");return {ok:true};
  }catch(e){await client.query("rollback");throw e;}finally{client.release();}
});

export const adminGetProductStockHistory=createServerFn({method:"GET"}).validator((data)=>data).handler(async({data})=>{
  await requireRole(data.token,["admin"]);
  const r=await (await getDb()).query("select sm.id,sm.quantity_delta,sm.movement_type,sm.reference_type,sm.reference_id,sm.note,sm.created_at,u.name actor_name from public.stock_movements sm left join neon_auth.\"user\" u on u.id=sm.created_by where sm.product_id=$1 order by sm.created_at desc limit 100",[data.productId]);
  return r.rows;
});

async function releaseExpiredStockReservations(db, actorId=null) {
  const client=await db.connect();
  try{
    await client.query("begin");
    const rows=await client.query(`select sr.id reservation_id,sr.product_id,sr.quantity,oi.order_id,o.customer_id,o.order_number,o.status previous_status
      from public.stock_reservations sr join public.order_items oi on oi.id=sr.order_item_id join public.orders o on o.id=oi.order_id
      where sr.status='reserved' and sr.expires_at<=now() and o.status in ('pending','confirmed') and o.delivery_status='unassigned'
      for update of sr,o skip locked`);
    for(const row of rows.rows){
      await client.query("update public.products set stock=stock+$2,updated_at=now() where id=$1",[row.product_id,row.quantity]);
      await client.query("update public.stock_reservations set status='expired',released_at=now() where id=$1",[row.reservation_id]);
      await client.query("insert into public.stock_movements(product_id,quantity_delta,movement_type,reference_type,reference_id,note,created_by) values($1,$2,'reservation_release','order',$3,'Libération après expiration de la réservation',$4)",[row.product_id,row.quantity,row.order_id,actorId]);
      await client.query("update public.orders set status='cancelled',cancelled_at=now(),updated_at=now() where id=$1",[row.order_id]);
      await client.query("update public.deliveries set status='failed',failure_reason='Réservation de stock expirée',updated_at=now() where order_id=$1 and status='unassigned'",[row.order_id]);
      await client.query("insert into public.order_status_history(order_id,previous_status,new_status,note,actor_id) values($1,$2,'cancelled','Expiration de la réservation de stock',$3)",[row.order_id,row.previous_status,actorId]);
      await client.query("insert into public.notifications(user_id,type,title,message,data) values($1,'order_cancelled','Commande annulée','Votre commande a été annulée car la réservation de stock a expiré.',$2)",[row.customer_id,{orderNumber:row.order_number}]);
    }
    await client.query("commit");return rows.rowCount;
  }catch(e){await client.query("rollback");throw e;}finally{client.release();}
}
export const adminReleaseExpiredReservations=createServerFn({method:"POST"}).validator((data)=>data).handler(async({data})=>{
  const admin=await requireRole(data.token,["admin"]);
  return {released:await releaseExpiredStockReservations(await getDb(),admin.id)};
});

export const getDeliveryProofUploadUrl=createServerFn({method:"POST"}).validator((data)=>data).handler(async({data})=>{
  const courier=await requireRole(data.token,["courier"]);
  const assigned=await (await getDb()).query("select id from public.deliveries where id=$1 and courier_id=$2",[data.deliveryId,courier.id]);
  if(!assigned.rowCount)fail("Cette livraison ne vous est pas attribuée.",403);
  const storage=await import("./storage.server");
  return storage.createDeliveryProofUpload({contentType:data.contentType,size:Number(data.size)});
});
export const getDeliveryProofDownloadUrl=createServerFn({method:"POST"}).validator((data)=>data).handler(async({data})=>{
  const user=await requireUser(data.token),db=await getDb();
  const roles=await db.query("select role from public.user_roles where user_id=$1 and is_active=true",[user.id]);
  const admin=roles.rows.some(row=>row.role==="admin");
  const assigned=await db.query("select 1 from public.deliveries where id=$1 and courier_id=$2",[data.deliveryId,user.id]);
  if(!admin&&!assigned.rowCount)fail("Accès à cette preuve de livraison refusé.",403);
  const key=clean(data.storageKey,1024);if(!key.startsWith("delivery-proofs/"))fail("Preuve invalide.");
  const storage=await import("./storage.server");
  return {url:await storage.createDeliveryProofDownload({key})};
});
