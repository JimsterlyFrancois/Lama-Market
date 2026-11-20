import { getDb } from "./db.server";

// Les paiements mobiles restent désactivés jusqu'à l'activation directe des API
// marchandes officielles MonCash et NatCash. Aucun agrégateur tiers n'est utilisé.
export async function getPaymentAvailability() {
  return { provider: null, cash_on_delivery: true, moncash: false, natcash: false,
    email_notifications: Boolean(process.env.RESEND_API_KEY && process.env.LAMA_MARKET_FROM_EMAIL) };
}
export async function startTranzakPayment() {
  const error = new Error("Les paiements en ligne ne sont pas activés. Choisissez le paiement à la livraison.");
  error.status = 503;
  throw error;
}
export async function reconcileTranzakPayment({ orderId, userId }) {
  const result = await getDb().query("select payment_status from public.orders where id=$1 and customer_id=$2", [orderId, userId]);
  if (!result.rowCount) { const error = new Error("Commande introuvable."); error.status = 404; throw error; }
  const status = result.rows[0].payment_status;
  return { status: ["paid", "cash_collected"].includes(status) ? "completed" : status === "failed" ? "failed" : "pending" };
}
export async function reconcilePendingTranzakPayments() {
  return { scanned: 0, confirmed: 0, pending: 0, errors: 0, skipped: true, message: "Aucun prestataire de paiement en ligne n'est configuré." };
}
