/**
 * Server-side authorization helpers for Lama Market.
 *
 * Use only after the request's identity has been verified by the server-side
 * authentication provider. Never pass a role supplied by the browser.
 */

export function requireAuthenticatedUser(context) {
  const user = context?.user;

  if (!user || typeof user.id !== "string" || user.id.length === 0) {
    const error = new Error("Authentification requise.");
    error.status = 401;
    error.code = "UNAUTHENTICATED";
    throw error;
  }

  return user;
}

export function requireUserRole(user, allowedRoles) {
  if (!user || typeof user.id !== "string" || user.id.length === 0) {
    const error = new Error("Authentification requise.");
    error.status = 401;
    error.code = "UNAUTHENTICATED";
    throw error;
  }

  if (!Array.isArray(allowedRoles) || allowedRoles.length === 0) {
    throw new TypeError("allowedRoles doit être une liste non vide.");
  }

  if (!allowedRoles.includes(user.role)) {
    const error = new Error("Accès refusé.");
    error.status = 403;
    error.code = "FORBIDDEN";
    throw error;
  }

  return user;
}
