import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { auth } from "./auth";

const http = httpRouter();

auth.addHttpRoutes(http);

http.route({
  path: "/webhooks/assemblyai",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const webhookSecret = process.env.WEBHOOK_SECRET;

    if (webhookSecret) {
      const providedSecret = request.headers.get("X-Webhook-Secret");
      if (providedSecret !== webhookSecret) {
        return new Response("Unauthorized", { status: 401 });
      }
    }

    let body: any;
    try {
      body = await request.json();
    } catch {
      return new Response("Invalid JSON", { status: 400 });
    }

    const { transcript_id, status, text, error } = body;

    if (!transcript_id || !status) {
      return new Response("Missing required fields", { status: 400 });
    }

    try {
      await ctx.runAction(internal.actions.transcription.handleWebhook, {
        transcriptId: transcript_id,
        status,
        text: text ?? undefined,
        error: error ?? undefined,
      });

      return new Response("OK", { status: 200 });
    } catch (err: any) {
      console.error("Webhook handler error:", err);
      return new Response("Internal error", { status: 500 });
    }
  }),
});

http.route({
  path: "/health",
  method: "GET",
  handler: httpAction(async () => {
    return new Response(JSON.stringify({ status: "healthy" }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }),
});

export default http;
