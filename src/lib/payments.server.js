import { getDb } from "./db.server";
import { createNotification } from "./notifications.server";
import { moneyToCents, sameMoney, tranzakEventKey, verifyHmacSha256 } from "./payment-security";

const TRANZAK_BASE = "https://api.tranzak.co/api/gateway/v1";
const finalPaymentStates = new Set(["paid", "refunded", "partially_refunded"]);

function gatewayError(payload, status) {
  const message = payload?.message || payload?.error || `Tranzak a répondu HTTP ${status}`;
  const error = new Error(String(message).slice(0, 300));
  error.status = status >= 500 ? 502 : 400;
  return error;
}

async function tranzakRequest(path, { method = "GET", body } = {}) {
  const apiKey = process.env.TRANZAK_API_KEY;
  if (!apiKey) {
    const error = new Error("Les paiements MonCash et NatCash ne sont pas encore configurés. Le paiement à la livraison reste disponible.");
    error.status = 503;
    throw error;
  }
  const response = await fetch(TRANZAK_BASE + path, {
    method,
    headers: {
      "X-Api-Key": apiKey,
      Accept: "application/json",
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
    signal: AbortSignal.timeout(12000),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (response.status === 404 && payload?.error === "transaction_not_found") return null;
    throw gatewayError(payload, response.status);
  }
  return payload;
}

function normalizedPayment(data) {
  return data?.data || data;
}

async function notifyCustomer(db, order, type, title, message, data = {}) {
  if (!order?.customer_id) return;
  return createNotification(db, {
    userId: order.customer_id, type, title, message,
    data: { orderId: order.id, orderNumber: order.order_number, ...data },
  });
}

async function releaseOrderReservations(client, orderId, actorId = null, note = "Réservation libérée après échec de paiement") {
  const rows = await client.query(
    `select sr.id,sr.product_id,sr.quantity from public.stock_reservations sr
     join public.order_items oi on oi.id=sr.order_item_id
     where oi.order_id=$1 and sr.status='reserved' for update of sr`,
    [orderId],
  );
  for (const row of rows.rows) {
    await client.query("update public.products set stock=stock+$2,updated_at=now() where id=$1", [row.product_id, row.quantity]);
    await client.query(
      "insert into public.stock_movements(product_id,quantity_delta,movement_type,reference_type,reference_id,note,created_by) values($1,$2,'reservation_release','order',$3,$4,$5)",
      [row.product_id, row.quantity, orderId, note, actorId],
    );
    await client.query("update public.stock_reservations set status='released',released_at=now() where id=$1", [row.id]);
  }
  await client.query("delete from public.coupon_redemptions where order_id=$1 and not exists (select 1 from public.payments where order_id=$1 and status='paid')", [orderId]);
}

export async function getPaymentAvailability() {
  const configured = Boolean(process.env.TRANZAK_API_KEY && process.env.TRANZAK_WEBHOOK_SECRET);
  return {
    provider: configured ? "tranzak" : null,
    cash_on_delivery: true,
    moncash: configured,
    natcash: configured,
    email_notifications: Boolean(process.env.RESEND_API_KEY && process.env.LAMA_MARKET_FROM_EMAIL),
  };
}

export async function startTranzakPayment({ orderId, userId }) {
  const db = getDb();
  const client = await db.connect();
  let order;
  let payment;
  try {
    await client.query("begin");
    const result = await client.query(
      `select o.id,o.order_number,o.customer_id,o.total,o.currency,o.status order_status,o.payment_status,
        o.address_snapshot,u.name customer_name,u.email,
        p.id payment_id,p.method,p.status payment_state,p.provider,p.external_reference,p.metadata
       from public.orders o
       join public.payments p on p.order_id=o.id
       join neon_auth."user" u on u.id=o.customer_id
       where o.id=$1 and o.customer_id=$2
         and p.method in ('moncash','natcash')
       order by p.created_at desc limit 1
       for update of o,p`,
      [orderId, userId],
    );
    if (!result.rowCount) {
      const error = new Error("Commande ou paiement introuvable.");
      error.status = 404;
      throw error;
    }
    order = result.rows[0];
    payment = result.rows[0];
    if (finalPaymentStates.has(payment.payment_state) || payment.payment_state === "failed" || order.payment_status === "failed") {
      const error = new Error("Ce paiement est déjà final. Consultez l'historique de vos commandes.");
      error.status = 409;
      throw error;
    }

    if (payment.provider === "tranzak" && payment.external_reference && payment.metadata?.payment_url) {
      await client.query("commit");
      return {
        paymentUrl: payment.metadata.payment_url,
        transactionId: payment.external_reference,
        status: payment.payment_state,
        reused: true,
      };
    }

    const referencePath = "/payments/reference/" + encodeURIComponent(order.order_number);
    let remote = await tranzakRequest(referencePath);
    let remoteData = normalizedPayment(remote);

    if (!remoteData) {
      remote = await tranzakRequest("/payments", {
        method: "POST",
        body: {
          amount: Number(order.total),
          currency: "HTG",
          payment_method: payment.method,
          customer_name: order.address_snapshot?.recipientName || order.customer_name || "Client Lama Market",
          customer_email: order.email || undefined,
          customer_phone: order.address_snapshot?.phone || undefined,
          reference: order.order_number,
          description: "Commande Lama Market " + order.order_number,
          metadata: { order_id: order.id, order_number: order.order_number },
        },
      });
      remoteData = normalizedPayment(remote);
      if (!remoteData?.transaction_id || !remoteData?.payment_url) {
        throw new Error("Tranzak n'a pas retourné de lien de paiement valide.");
      }
    }

    if (remoteData.reference !== order.order_number ||
        !sameMoney(remoteData.amount, order.total) ||
        remoteData.currency !== "HTG" ||
        remoteData.payment_method !== payment.method) {
      throw new Error("La référence, le montant ou le moyen de paiement retourné par Tranzak ne correspond pas à la commande.");
    }

    const paymentUrl = remoteData.payment_url || null;
    await client.query(
      `update public.payments set provider='tranzak',external_reference=$2,
        metadata=coalesce(metadata,'{}'::jsonb) || $3::jsonb,updated_at=now()
       where id=$1`,
      [payment.payment_id, String(remoteData.transaction_id), JSON.stringify({
        payment_url: paymentUrl,
        provider_status: remoteData.status,
        payment_method: remoteData.payment_method,
      })],
    );
    await client.query("commit");

    if (remoteData.status === "completed" || remoteData.status === "failed") {
      await applyTranzakPaymentState(db, remoteData, "payment." + (remoteData.status === "completed" ? "success" : "failed"), false);
    }

    return {
      paymentUrl,
      transactionId: String(remoteData.transaction_id),
      status: remoteData.status,
      reused: Boolean(remote && !remoteData.payment_url),
      message: paymentUrl ? null : "Une transaction existe déjà. Son statut sera vérifié côté serveur ; ne relancez pas un second paiement.",
    };
  } catch (error) {
    await client.query("rollback").catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

async function applyTranzakPaymentState(db, data, eventName, signatureValid, rawPayload = {}) {
  const transactionId = String(data?.transaction_id || "");
  const reference = String(data?.reference || "");
  if (!transactionId || !reference) {
    const error = new Error("Événement de paiement incomplet.");
    error.status = 400;
    throw error;
  }
  if (!["completed", "failed"].includes(data.status)) {
    return { processed: false, status: data.status || "unknown" };
  }
  const paymentEventId = signatureValid
    ? tranzakEventKey(eventName, transactionId)
    : tranzakEventKey("reconcile:" + data.status, transactionId);

  const client = await db.connect();
  let notification = null;
  let result;
  try {
    await client.query("begin");
    const found = await client.query(
      `select p.id payment_id,p.order_id,p.method,p.amount payment_amount,p.currency payment_currency,
        p.status payment_state,p.external_reference,o.id,o.order_number,o.customer_id,o.total,o.currency,
        o.status order_status,o.payment_status,o.delivery_status
       from public.payments p join public.orders o on o.id=p.order_id
       where (p.external_reference=$1 or o.order_number=$2)
         and p.provider='tranzak' and p.method in ('moncash','natcash')
       order by p.created_at desc limit 1
       for update of p,o`,
      [transactionId, reference],
    );
    if (!found.rowCount) {
      await client.query("rollback");
      return { processed: false, reason: "payment_not_linked" };
    }
    const row = found.rows[0];
    if (row.order_number !== reference ||
        !sameMoney(data.amount, row.total) ||
        !sameMoney(data.amount, row.payment_amount) ||
        data.currency !== "HTG" ||
        data.payment_method !== row.method) {
      const error = new Error("Les données Tranzak ne correspondent pas au paiement enregistré.");
      error.status = 409;
      throw error;
    }

    const event = await client.query(
      `insert into public.payment_transactions(payment_id,provider_event_id,event_type,signature_valid,payload,processed_at)
       values($1,$2,$3,$4,$5,now()) on conflict(provider_event_id) do nothing returning id`,
      [row.payment_id, paymentEventId, eventName, signatureValid, rawPayload],
    );
    if (!event.rowCount) {
      await client.query("commit");
      return { processed: false, duplicate: true, status: row.payment_state };
    }

    await client.query(
      "update public.payments set external_reference=$2,provider='tranzak',metadata=coalesce(metadata,'{}'::jsonb)||$3::jsonb,updated_at=now() where id=$1",
      [row.payment_id, transactionId, JSON.stringify({ provider_status: data.status })],
    );

    if (data.status === "completed" && !finalPaymentStates.has(row.payment_state)) {
      await client.query(
        "update public.payments set status='paid',paid_at=coalesce(paid_at,now()),updated_at=now() where id=$1 and status in ('pending','failed')",
        [row.payment_id],
      );
      await client.query(
        `update public.orders set payment_status='paid',
          status=case when status='pending' then 'confirmed' else status end,
          confirmed_at=coalesce(confirmed_at,now()),updated_at=now()
         where id=$1 and payment_status not in ('paid','cash_collected','refunded','partially_refunded')`,
        [row.order_id],
      );
      await client.query(
        "update public.stock_reservations set expires_at=now()+interval '48 hours' where order_item_id in(select id from public.order_items where order_id=$1) and status='reserved'",
        [row.order_id],
      );
      await client.query(
        "insert into public.order_status_history(order_id,previous_status,new_status,note) values($1,$2,'confirmed','Paiement Tranzak confirmé par vérification serveur')",
        [row.order_id, row.order_status],
      );
      notification = {
        userId: row.customer_id,
        type: "payment_success",
        title: "Paiement confirmé",
        message: "Le paiement de la commande " + row.order_number + " a été confirmé.",
        data: { orderId: row.order_id, orderNumber: row.order_number, transactionId },
      };
      result = { processed: true, status: "paid", orderId: row.order_id };
    } else if (data.status === "failed" && !finalPaymentStates.has(row.payment_state)) {
      await client.query("update public.payments set status='failed',updated_at=now() where id=$1 and status='pending'", [row.payment_id]);
      await client.query(
        "update public.orders set payment_status='failed',status='cancelled',cancelled_at=now(),updated_at=now() where id=$1 and payment_status='pending'",
        [row.order_id],
      );
      await releaseOrderReservations(client, row.order_id, null);
      await client.query("insert into public.order_status_history(order_id,previous_status,new_status,note) values($1,$2,'cancelled','Paiement Tranzak échoué ou expiré')", [row.order_id, row.order_status]);
      await client.query("update public.deliveries set status='failed',failure_reason='Paiement non confirmé',updated_at=now() where order_id=$1 and status='unassigned'", [row.order_id]);
      notification = {
        userId: row.customer_id,
        type: "payment_failed",
        title: "Paiement non confirmé",
        message: "Le paiement de la commande " + row.order_number + " n'a pas été confirmé. Votre commande a été annulée.",
        data: { orderId: row.order_id, orderNumber: row.order_number, transactionId },
      };
      result = { processed: true, status: "failed", orderId: row.order_id };
    } else {
      result = { processed: true, status: row.payment_state, orderId: row.order_id };
    }
    await client.query(
      "update public.payment_transactions set processed_at=now() where provider_event_id=$1",
      [paymentEventId],
    );
    await client.query("commit");
  } catch (error) {
    await client.query("rollback").catch(() => {});
    throw error;
  } finally {
    client.release();
  }

  if (notification) await createNotification(db, notification);
  return result;
}

export async function processTranzakWebhook(rawBody, signature) {
  const secret = process.env.TRANZAK_WEBHOOK_SECRET;
  if (!verifyHmacSha256(rawBody, signature, secret)) {
    const error = new Error("Signature de paiement invalide.");
    error.status = 403;
    throw error;
  }
  let event;
  try {
    event = JSON.parse(Buffer.from(rawBody).toString("utf8"));
  } catch {
    const error = new Error("Corps du webhook invalide.");
    error.status = 400;
    throw error;
  }
  const headerEvent = String(event?.event || "");
  const allowed = new Set(["payment.success", "payment.failed", "payment.refunded"]);
  if (!allowed.has(headerEvent)) return { ignored: true };
  if (headerEvent === "payment.refunded") {
    return { ignored: true, reason: "provider_refund_event_not_enabled_for_mobile_wallets" };
  }
  const data = event.data || {};
  if ((headerEvent === "payment.success" && data.status !== "completed") ||
      (headerEvent === "payment.failed" && data.status !== "failed")) {
    const error = new Error("Le statut du webhook ne correspond pas à son type d'événement.");
    error.status = 400;
    throw error;
  }
  return applyTranzakPaymentState(getDb(), data, headerEvent, true, event);
}

export async function reconcileTranzakPayment({ orderId, userId }) {
  const db = getDb();
  const found = await db.query(
    `select p.id payment_id,p.external_reference,p.method,p.provider,p.status payment_state,
       o.id,o.order_number,o.customer_id
     from public.payments p join public.orders o on o.id=p.order_id
     where o.id=$1 and o.customer_id=$2 and p.method in ('moncash','natcash')
     order by p.created_at desc limit 1`,
    [orderId, userId],
  );
  if (!found.rowCount) {
    const error = new Error("Paiement de cette commande introuvable.");
    error.status = 404;
    throw error;
  }
  const row = found.rows[0];
  if (finalPaymentStates.has(row.payment_state) || ["failed", "cancelled"].includes(row.payment_state)) {
    return { status: row.payment_state, orderNumber: row.order_number };
  }
  if (!process.env.TRANZAK_API_KEY) {
    const error = new Error("La vérification du paiement n'est pas configurée.");
    error.status = 503;
    throw error;
  }
  let data;
  if (row.external_reference) {
    const verify = await tranzakRequest("/payments/" + encodeURIComponent(row.external_reference) + "/verify", { method: "POST" });
    if (verify?.data?.status === "failed" || verify?.data?.status === "completed") {
      const details = await tranzakRequest("/payments/" + encodeURIComponent(row.external_reference));
      data = normalizedPayment(details);
    } else {
      const details = await tranzakRequest("/payments/" + encodeURIComponent(row.external_reference));
      data = normalizedPayment(details);
    }
  } else {
    const remote = await tranzakRequest("/payments/reference/" + encodeURIComponent(row.order_number));
    data = normalizedPayment(remote);
    if (data?.transaction_id) {
      await db.query("update public.payments set provider='tranzak',external_reference=$2,metadata=metadata||$3::jsonb,updated_at=now() where id=$1", [row.payment_id, String(data.transaction_id), JSON.stringify({ provider_status: data.status })]);
    }
  }
  if (!data) return { status: "pending", orderNumber: row.order_number };
  if (data.reference !== row.order_number || !sameMoney(data.amount, (await db.query("select total from public.orders where id=$1", [orderId])).rows[0]?.total) ||
      data.currency !== "HTG" || data.payment_method !== row.method) {
    const error = new Error("Les informations du paiement reçu ne correspondent pas à la commande.");
    error.status = 409;
    throw error;
  }
  const eventName = data.status === "completed" ? "payment.success" : data.status === "failed" ? "payment.failed" : null;
  if (eventName) await applyTranzakPaymentState(db, data, eventName, false, { source: "server_reconciliation", data });
  return { status: data.status, orderNumber: row.order_number };
}
