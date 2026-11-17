/**
 * Lama Market — server-side authentication guard.
 *
 * This helper is intentionally framework-agnostic. Call it inside every
 * server handler that reads or changes private customer, order, or staff data.
 * It does not replace route/server-function middleware: the server must still
 * authenticate the request and populate context.user before this is called.
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

/**
 * Require an allowed application role after authentication.
 * Never trust a role sent by the browser; pass only the role read from the
 * authenticated server-side user record.
 */
export function requireUserRole(user, allowedRoles) {
  if (!user || typeof user.id !== "string") {
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
