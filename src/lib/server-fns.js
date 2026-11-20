import { createServerFn } from "@tanstack/react-start";

/**
 * Public diagnostic endpoint. It reports integration availability without
 * exposing database URLs, credentials, tokens, or internal exception details.
 */
export const getApplicationHealth = createServerFn({ method: "GET" }).handler(
  async () => {
    let database = "unavailable";
    try {
      const { getDb } = await import("./db.server");
      await getDb().query("select 1");
      database = "connected";
    } catch {
      // Keep the public health response free of infrastructure details.
    }

    const auth = process.env.NEON_AUTH_BASE_URL && process.env.NEON_AUTH_JWKS_URL
      ? "configured"
      : "missing";
    const storage = process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY && process.env.AWS_ENDPOINT_URL_S3
      ? "configured"
      : "missing";

    return {
      application: "Lama Market",
      status: database === "connected" && auth === "configured" ? "ok" : "degraded",
      integrations: { neon_postgres: database, neon_auth: auth, neon_object_storage: storage },
    };
  },
);
