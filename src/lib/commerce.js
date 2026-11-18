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
    db.query("select id,name,description,category,price,old_price,stock,badge,rating,reviews,image_url,is_active,sort_order,sku,slug,is_featured from public.products where is_active=true and deleted_at is null order by is_featured desc,sort_order asc,name asc"),
    db.query("select slug,name from public.categories where is_active=true order by sort_order"),
  ]);
  return { products: products.rows, categories: categories.rows };
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
    "select ci.id,ci.product_id,ci.quantity,p.name,p.price,p.stock,p.image_url,p.is_active from public.carts c join public.cart_items ci on ci.cart_id=c.id join public.products p on p.id=ci.product_id where c.user_id=$1 and c.status='active' order by ci.created_at",
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
  const address = data.address || {};
  const required = ["recipientName","phone","addressLine","city"];
  if (required.some((key) => !clean(address[key], 180))) fail("Complétez le nom, le téléphone, l'adresse et la ville.");
  const db = await getDb();
  const client = await db.connect();
  const idem = clean(data.idempotencyKey, 100) || crypto.randomUUID();
  try {
    await client.query("begin");
    const prior = await client.query("select id,order_number from public.orders where idempotency_key=$1", [idem]);
    if (prior.rowCount) { await client.query("commit"); return { id: prior.rows[0].id, orderNumber: prior.rows[0].order_number }; }
    const cart = await client.query("select id from public.carts where user_id=$1 and status='active' for update", [user.id]);
    if (!cart.rowCount) fail("Votre panier est vide.");
    const items = await client.query(
      "select ci.product_id,ci.quantity,p.name,p.sku,p.price,p.stock from public.cart_items ci join public.products p on p.id=ci.product_id where ci.cart_id=$1 and p.is_active=true and p.deleted_at is null for update of p",
      [cart.rows[0].id],
    );
    if (!items.rowCount) fail("Votre panier est vide ou contient des produits indisponibles.");
    let subtotal = 0;
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
    const total = subtotal + deliveryFee;
    const orderNumber = "LM-" + new Date().toISOString().slice(0,10).replaceAll("-","") + "-" + crypto.randomUUID().slice(0,8).toUpperCase();
    const snapshot = {
      recipientName: clean(address.recipientName,180), phone: clean(address.phone,40),
      addressLine: clean(address.addressLine,250), city: clean(address.city,100),
      area: clean(address.area,100), landmark: clean(address.landmark,180),
      instructions: clean(address.instructions,500),
    };
    const order = await client.query(
      "insert into public.orders(order_number,customer_id,status,payment_status,delivery_status,subtotal,delivery_fee,total,address_snapshot,customer_note,idempotency_key,confirmed_at) values($1,$2,'confirmed','cash_due','unassigned',$3,$4,$5,$6,$7,$8,now()) returning id",
      [orderNumber,user.id,subtotal,deliveryFee,total,snapshot,clean(data.note,500)||null,idem],
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
    db.query("select id,name,description,category,price,old_price,stock,is_active,image_url,sku,low_stock_threshold from public.products where deleted_at is null order by created_at desc limit 100"),
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
  const result=await db.query("select d.id,d.status,d.fee,d.scheduled_at,o.order_number,o.total,o.payment_status from public.deliveries d join public.orders o on o.id=d.order_id where d.courier_id=$1 order by d.created_at desc",[courier.id]);
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
    if (data.status === "delivered" && delivery.rows[0].payment_status === "cash_due" && data.cashCollected !== true) fail("Confirmez la réception du paiement en espèces avant de clôturer cette livraison.");
    await client.query("update public.deliveries set status=$2,picked_up_at=case when $2='in_transit' then now() else picked_up_at end,delivered_at=case when $2='delivered' then now() else delivered_at end,recipient_name=$3,proof_url=$4,failure_reason=$5,courier_note=$6,updated_at=now() where id=$1",[data.deliveryId,data.status,clean(data.recipientName,120)||null,clean(data.proofUrl,1000)||null,clean(data.failureReason,500)||null,clean(data.note,500)||null]);
    await client.query("update public.orders set delivery_status=$2,updated_at=now() where id=$1",[delivery.rows[0].order_id,data.status]);
    await client.query("insert into public.delivery_events(delivery_id,status,note,proof_url,actor_id) values($1,$2,$3,$4,$5)",[data.deliveryId,data.status,clean(data.note,500)||null,clean(data.proofUrl,1000)||null,courier.id]);
    if(data.status==="delivered" && data.cashCollected===true){
      await client.query("update public.payments set status='cash_collected',paid_at=now(),updated_at=now() where order_id=$1 and method='cash_on_delivery'",[delivery.rows[0].order_id]);
      await client.query("update public.orders set payment_status='cash_collected',status='completed',completed_at=now(),updated_at=now() where id=$1",[delivery.rows[0].order_id]);
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
  const result = await db.query("select d.id,d.status,d.fee,o.order_number,o.total,cp.display_name courier_name,cp.user_id courier_id from public.deliveries d join public.orders o on o.id=d.order_id left join public.courier_profiles cp on cp.user_id=d.courier_id order by d.created_at desc limit 50");
  return result.rows;
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
  const result=await db.query("update public.products set name=$2,description=$3,category=$4,price=$5,old_price=$6,image_url=$7,is_active=$8,low_stock_threshold=$9,updated_at=now() where id=$1 and deleted_at is null returning id",[data.productId,name,clean(data.description,2000)||null,category,price,data.oldPrice?Number(data.oldPrice):null,clean(data.imageUrl,1000)||null,data.isActive===true,Math.max(0,Number(data.lowStockThreshold)||5)]);
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
