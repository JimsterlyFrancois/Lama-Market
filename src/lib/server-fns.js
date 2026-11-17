import { createServerFn } from "@tanstack/react-start";

/**
 * Public, non-sensitive diagnostic endpoint.
 * This confirms that the TanStack server-function pipeline is available.
 * It deliberately does not claim that Supabase is connected.
 */
export const getApplicationHealth = createServerFn({ method: "GET" }).handler(
  async () => ({
    application: "Lama Market",
    status: "ok",
    integrations: {
      supabase: "not_configured",
    },
  }),
);
