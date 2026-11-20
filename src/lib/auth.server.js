import { createRemoteJWKSet, jwtVerify } from "jose";
import { getDb } from "./db.server";

let jwks;

function getJwks() {
  const url = process.env.NEON_AUTH_JWKS_URL;
  if (!url) throw new Error("NEON_AUTH_JWKS_URL n'est pas configurée.");
  if (!jwks) jwks = createRemoteJWKSet(new URL(url));
  return jwks;
}

export async function requireUser(token) {
  if (typeof token !== "string" || !token) {
    const error = new Error("Connectez-vous pour continuer.");
    error.status = 401;
    throw error;
  }
  const issuer = process.env.NEON_AUTH_BASE_URL;
  if (!issuer) throw new Error("NEON_AUTH_BASE_URL n'est pas configurée.");
  const { payload } = await jwtVerify(token, getJwks(), { issuer });
  if (typeof payload.sub !== "string") {
    const error = new Error("Session invalide.");
    error.status = 401;
    throw error;
  }
  return { id: payload.sub, email: typeof payload.email === "string" ? payload.email : null };
}

export async function requireRole(token, roles) {
  const user = await requireUser(token);
  const db = getDb();
  const identity = await db.query('select email from neon_auth."user" where id=$1', [user.id]);
  const verifiedEmail = identity.rows[0]?.email;
  if (verifiedEmail && process.env.LAMA_MARKET_ADMIN_EMAIL &&
      verifiedEmail.toLowerCase() === process.env.LAMA_MARKET_ADMIN_EMAIL.toLowerCase()) {
    await db.query(
      "insert into public.user_roles(user_id,role,is_active) values($1,'admin',true) on conflict(user_id,role) do update set is_active=true",
      [user.id],
    );
  }
  const result = await db.query(
    "select role from public.user_roles where user_id=$1 and is_active=true",
    [user.id],
  );
  const userRoles = result.rows.map((row) => row.role);
  if (!roles.some((role) => userRoles.includes(role))) {
    const error = new Error("Vous n'avez pas l'autorisation d'effectuer cette action.");
    error.status = 403;
    throw error;
  }
  return { ...user, roles: userRoles };
}

export async function ensureCustomer(token) {
  const user = await requireUser(token);
  const db = getDb();
  await db.query(
    "insert into public.user_roles(user_id,role) values($1,'customer') on conflict(user_id,role) do nothing",
    [user.id],
  );
  await db.query(
    "insert into public.customer_profiles(user_id) values($1) on conflict(user_id) do nothing",
    [user.id],
  );
  await db.query(
    "insert into public.carts as existing_cart(user_id) values($1) on conflict(user_id) do update set status='active',updated_at=now() where existing_cart.status<>'active'",
    [user.id],
  );
  return user;
}
