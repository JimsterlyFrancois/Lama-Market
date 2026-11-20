import { createFileRoute } from "@tanstack/react-router";
import { processTranzakWebhook } from "../lib/payments.server";

export const Route = createFileRoute("/api/webhooks/tranzak")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const rawBody = Buffer.from(await request.arrayBuffer());
          const signature = request.headers.get("X-Tranzak-Signature") || "";
          await processTranzakWebhook(rawBody, signature);
          return new Response(null, { status: 200 });
        } catch (error) {
          const status = Number(error?.status) || 500;
          const publicMessage = status >= 500 ? "Webhook temporairement indisponible." : error.message;
          return Response.json({ error: publicMessage }, { status });
        }
      },
    },
  },
});
