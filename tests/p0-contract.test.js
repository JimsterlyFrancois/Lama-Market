import test from "node:test";
import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");

test("server functions use the supported TanStack validator API", async () => {
  const commerce = await read("../src/lib/commerce.js");
  assert.doesNotMatch(commerce, /\.inputValidator\s*\(/);
  assert.match(commerce, /\.validator\s*\(/);
});

test("the application uses Neon Auth and does not declare legacy auth SDKs", async () => {
  const pkg = JSON.parse(await read("../package.json"));
  const dependencies = { ...pkg.dependencies, ...pkg.devDependencies };
  assert.ok(dependencies["@neon/auth"]);
  assert.equal(dependencies["@supabase/supabase-js"], undefined);
  assert.equal(dependencies["@base44/sdk"], undefined);
});

test("the official cover and logo are included in the storefront", async () => {
  const home = await read("../src/routes/index.jsx");
  const root = await read("../src/routes/__root.jsx");
  assert.match(home, /\/images\/lama-market-cover\.webp/);
  assert.match(home, /\/images\/lama-market-logo\.svg/);
  assert.match(root, /rel: "icon"/);
  await access(new URL("../public/images/lama-market-cover.webp", import.meta.url));
  await access(new URL("../public/images/lama-market-logo.svg", import.meta.url));
});

test("legacy Base44 and Supabase Auth entry points are absent", async () => {
  for (const path of [
    "../src/api/base44Client.js",
    "../src/lib/supabase.js",
    "../base44/config.jsonc",
  ]) {
    await assert.rejects(access(new URL(path, import.meta.url)));
  }
});

test("server-side permissions are derived from verified Neon identity and database roles", async () => {
  const auth = await read("../src/lib/auth.server.js");
  const commerce = await read("../src/lib/commerce.js");
  assert.match(auth, /jwtVerify\(token, getJwks\(\), \{ issuer \}\)/);
  assert.match(auth, /select role from public\.user_roles where user_id=\$1 and is_active=true/);
  assert.match(commerce, /requireRole\(data\.token, \["admin"\]\)/);
  assert.doesNotMatch(auth, /payload\.role/);
});

test("the animated storefront cover is uploadable only by administrators", async () => {
  const storage = await read("../src/lib/storage.server.js");
  const commerce = await read("../src/lib/commerce.js");
  const admin = await read("../src/routes/admin.jsx");
  const home = await read("../src/routes/index.jsx");
  assert.match(storage, /contentType !== "image\/gif"/);
  assert.match(commerce, /getCoverImageUploadUrl/);
  assert.match(commerce, /requireRole\(data\.token, \["admin"\]\)/);
  assert.match(commerce, /store_settings/);
  assert.match(admin, /accept="image\/gif/);
  assert.match(home, /getStorefrontSettings/);
});


test("P1: the public catalogue uses database categories and product image galleries", async () => {
  const commerce = await read("../src/lib/commerce.js");
  const home = await read("../src/routes/index.jsx");
  assert.match(commerce, /from public\.categories/);
  assert.match(commerce, /from public\.product_images/);
  assert.match(commerce, /category_name/);
  assert.match(home, /categories\.map/);
  assert.match(home, /product\.images/);
});

test("P1: customers own their saved addresses and only one default address is indexed", async () => {
  const commerce = await read("../src/lib/commerce.js");
  const migration = await read("../database/migrations/202611190001_p1_commerce_constraints.sql");
  assert.match(commerce, /public\.addresses where id=\$1 and user_id=\$2/);
  assert.match(commerce, /export const getMyAddresses/);
  assert.match(commerce, /export const saveMyAddress/);
  assert.match(commerce, /export const deleteMyAddress/);
  assert.match(migration, /unique index if not exists addresses_one_default_per_user_idx/);
});

test("P1: checkout is owner-scoped, idempotent, stock-checked, and redeems coupons after order creation", async () => {
  const commerce = await read("../src/lib/commerce.js");
  const checkout = commerce.slice(commerce.indexOf("export const checkout"), commerce.indexOf("export const getMyOrders"));
  assert.match(checkout, /o\.idempotency_key=\$1 and o\.customer_id=\$2/);
  assert.match(checkout, /for update of p/);
  assert.match(checkout, /stock >= \$2/);
  assert.match(checkout, /discount_total/);
  assert.ok(checkout.indexOf("insert into public.orders") < checkout.indexOf("insert into public.coupon_redemptions"));
  assert.match(checkout, /public\.stock_reservations/);
  assert.match(checkout, /public\.deliveries/);
});

test("P1: administration exposes categories, coupons, customers, employees and product galleries", async () => {
  const commerce = await read("../src/lib/commerce.js");
  const admin = await read("../src/routes/admin.jsx");
  for (const fn of ["adminListCategories","adminUpsertCategory","adminArchiveCategory","adminListCustomers","adminListStaff","adminAddStaff","adminUpdateStaff","adminListCoupons","adminUpsertCoupon","adminArchiveCoupon","adminAddProductImage","adminSetPrimaryProductImage","adminDeleteProductImage","adminGetProductStockHistory"]) {
    assert.match(commerce, new RegExp("export const " + fn + "\\s*="));
  }
  assert.match(admin, /Gestion des employés et responsabilités/);
  assert.match(admin, /Catégories du catalogue/);
  assert.match(admin, /Codes promotionnels et coupons/);
  assert.match(admin, /Clients/);
  assert.match(admin, /Ajouter une image/);
});

test("P1: courier assignments include recipient contact data and private proof files are owner-scoped", async () => {
  const commerce = await read("../src/lib/commerce.js");
  const storage = await read("../src/lib/storage.server.js");
  const courier = await read("../src/routes/livreur.jsx");
  assert.match(commerce, /o\.address_snapshot/);
  assert.match(commerce, /o\.customer_note/);
  assert.match(commerce, /getDeliveryProofUploadUrl/);
  assert.match(commerce, /delivery\.rows\[0\]\.proof_url!==key/);
  assert.match(storage, /Bucket: "uploads"/);
  assert.match(storage, /delivery-proofs\//);
  assert.match(courier, /address\.phone/);
  assert.match(courier, /Preuve de remise/);
  assert.match(courier, /Raison de l'échec/);
});

test("P1: inventory reservations expire, release stock and retain a movement history", async () => {
  const commerce = await read("../src/lib/commerce.js");
  const admin = await read("../src/routes/admin.jsx");
  assert.match(commerce, /async function releaseExpiredStockReservations/);
  assert.match(commerce, /sr\.expires_at<=now\(\)/);
  assert.match(commerce, /movement_type,reference_type,reference_id,note,created_by/);
  assert.match(commerce, /adminReleaseExpiredReservations/);
  assert.match(admin, /Libérer les réservations expirées/);
  assert.match(admin, /Historique des mouvements de stock/);
});

test("P1: Neon Auth customer screens implement verification OTP and password recovery", async () => {
  const client = await read("../src/lib/auth-client.js");
  const auth = await read("../src/routes/auth.jsx");
  const reset = await read("../src/routes/reinitialiser.jsx");
  assert.match(client, /sendVerificationOtp/);
  assert.match(client, /verifyEmail/);
  assert.match(client, /emailOtp\.requestPasswordReset/);
  assert.match(client, /emailOtp\.resetPassword/);
  assert.match(auth, /email-verification/);
  assert.match(auth, /Vérifier votre adresse/);
  assert.match(auth, /Mot de passe oublié/);
  assert.match(reset, /emailOtp\.resetPassword/);
});

test("P1: administrators can maintain and deactivate delivery zones and rates", async () => {
  const commerce = await read("../src/lib/commerce.js");
  const admin = await read("../src/routes/admin.jsx");
  assert.match(commerce, /export const adminListDeliveryZones/);
  assert.match(commerce, /export const adminUpdateDeliveryZone/);
  assert.match(commerce, /export const adminArchiveDeliveryZone/);
  assert.match(admin, /Zones et frais de livraison/);
  assert.match(admin, /Modifier/);
  assert.match(admin, /Désactiver/);
});


test("P2: mobile payments stay disabled until direct official MonCash and NatCash APIs are configured", async () => {
  const payments = await read("../src/lib/payments.server.js");
  const commerce = await read("../src/lib/commerce.js");
  const cart = await read("../src/routes/panier.jsx");
  assert.match(payments,/moncash:\s*false/);
  assert.match(payments,/natcash:\s*false/);
  assert.match(payments,/cash_on_delivery:\s*true/);
  assert.doesNotMatch(payments,/api\.tranzak\.co|TRANZAK_API_KEY|X-Tranzak-Signature/i);
  assert.match(commerce,/paymentMethod !== "cash_on_delivery"/);
  assert.match(commerce,/provider: null/);
  assert.match(cart,/paymentOptions\.moncash/);
  assert.match(cart,/paymentOptions\.natcash/);
 });

test("P2: the storefront has no third-party payment webhook or gateway implementation", async () => {
  const commerce = await read("../src/lib/commerce.js");
  assert.doesNotMatch(commerce,/startTranzakPayment|reconcileTranzakPayment|tranzak/i);
  await assert.rejects(access(new URL("../src/routes/api.webhooks.tranzak.jsx", import.meta.url)));
  assert.match(commerce,/paymentStatus/);
 });

test("P2: login and the professional profile entry are visible and staff access remains role-controlled", async () => {
  const header = await read("../src/components/site/Header.jsx");
  const menu = await read("../src/components/site/AccountMenu.jsx");
  const auth = await read("../src/routes/auth.jsx");
  const serverAuth = await read("../src/lib/auth.server.js");
  assert.match(header,/Connexion/);
  assert.match(menu,/UserRound/);
  assert.match(menu,/Espace professionnel/);
  assert.match(auth,/validé et recevoir un rôle attribué par l’administrateur principal/);
  assert.match(serverAuth,/requireRole/);
 });

test("P2: refunds are auditable and cannot be closed without a transaction reference and private proof", async () => {
  const migration = await read("../database/migrations/202611200001_p2_payments_notifications_reporting.sql");
  const commerce = await read("../src/lib/commerce.js");
  const storage = await read("../src/lib/storage.server.js");
  const admin = await read("../src/routes/admin.jsx");
  const orders = await read("../src/routes/commandes.jsx");
  assert.match(migration,/create table if not exists public\.payment_refunds/);
  assert.match(commerce,/export const adminCreateRefund/);
  assert.match(commerce,/proofKey\?\.startsWith\("refund-proofs\//);
  assert.match(commerce,/externalReference/);
  assert.match(commerce,/public\.audit_logs/);
  assert.match(storage,/refund-proofs\//);
  assert.match(admin,/Enregistrer le remboursement/);
  assert.match(orders,/o\.refunds/);
});

test("P2: notification channels are tracked and email opt-out is respected", async () => {
  const migration = await read("../database/migrations/202611200001_p2_payments_notifications_reporting.sql");
  const notifications = await read("../src/lib/notifications.server.js");
  const commerce = await read("../src/lib/commerce.js");
  const account = await read("../src/routes/compte.jsx");
  assert.match(migration,/create table if not exists public\.notification_preferences/);
  assert.match(migration,/create table if not exists public\.notification_deliveries/);
  assert.match(notifications,/RESEND_API_KEY/);
  assert.match(notifications,/email_enabled/);
  assert.match(notifications,/status='skipped'/);
  assert.match(commerce,/export const updateMyNotificationPreferences/);
  assert.match(account,/Notifications par e-mail/);
  assert.match(account,/Notifications par SMS/);
});

test("P2: sales, payment and inventory reports are exportable as CSV", async () => {
  const commerce = await read("../src/lib/commerce.js");
  const admin = await read("../src/routes/admin.jsx");
  assert.match(commerce,/export const getAdminReports/);
  assert.match(commerce,/net_collected/);
  assert.match(commerce,/paymentMethods/);
  assert.match(commerce,/refunds r where r\.order_id=o\.id and r\.status='completed'/);
  assert.match(admin,/exportCsv\(/);
  assert.match(admin,/Exporter ventes CSV/);
  assert.match(admin,/Exporter produits CSV/);
  assert.match(admin,/Exporter stocks CSV/);
  assert.match(admin,/Exporter paiements CSV/);
});

test("P2: notifications are emitted for order, delivery, payment, refund and stock events", async () => {
  const commerce = await read("../src/lib/commerce.js");
  const payments = await read("../src/lib/payments.server.js");
  const notifications = await read("../src/lib/notifications.server.js");
  assert.match(commerce,/createNotification\(db/);
  assert.match(commerce,/createAdminNotification\(db/);
  assert.match(commerce,/Alerte de stock faible/);
  assert.match(payments,/payment_success/);
  assert.match(payments,/payment_failed/);
  assert.match(payments,/createAdminNotification/);
  assert.match(notifications,/createAdminNotification/);
});

test("P2: responsive accessibility settings and reduced-motion support remain in place", async () => {
  const css = await read("../src/styles/app.css");
  const home = await read("../src/routes/index.jsx");
  const admin = await read("../src/routes/admin.jsx");
  assert.match(css,/@media\(max-width:640px\)/);
  assert.match(css,/prefers-reduced-motion:reduce/);
  assert.match(css,/focus-visible/);
  assert.match(home,/aria-label="Rechercher un produit"/);
  assert.match(home,/loading="lazy"/);
  assert.match(admin,/report-table-wrap/);
});
