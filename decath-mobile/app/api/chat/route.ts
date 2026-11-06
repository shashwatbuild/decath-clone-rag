import Anthropic from "@anthropic-ai/sdk";
import { respond, type ChatRequest } from "@/lib/rag/assistant";
import { activeProvider, streamAnswer, type HistoryTurn } from "@/lib/rag/llm";
import { GeminiError } from "@/lib/rag/gemini";

/**
 * POST { message, contextIds?, listIds?, lastFocusId?, productId?, history? }
 * Responds with newline-delimited JSON events:
 *   {"type":"meta", products?, compare?, suggestions?, source}   - cards/table to render
 *   {"type":"text", "delta": "..."}                               - reply text, streamed
 *   {"type":"replace", "text": "..."}                             - discard streamed text, use this instead
 *   {"type":"source", "source": "offline"}                        - the LLM failed; reply is the rule-based answer
 *   {"type":"done"}
 */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as (ChatRequest & { history?: HistoryTurn[] }) | null;
  if (!body?.message || typeof body.message !== "string")
    return Response.json({ error: "message is required" }, { status: 400 });

  const message = body.message.slice(0, 1000);
  const history = (Array.isArray(body.history) ? body.history : [])
    .filter((t) => (t.role === "user" || t.role === "assistant") && typeof t.text === "string")
    .map((t) => ({ role: t.role, text: t.text.slice(0, 2000) }));

  // Retrieval + routing (always runs; picks products and builds cards / compare table)
  const routed = respond({ message, contextIds: body.contextIds, listIds: body.listIds, lastFocusId: body.lastFocusId, productId: body.productId });
  const provider = activeProvider();

  const enc = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (o: object) => controller.enqueue(enc.encode(JSON.stringify(o) + "\n"));
      send({ type: "meta", products: routed.products, compare: routed.compare, suggestions: routed.suggestions, action: routed.action, source: provider ?? "rag" });

      if (!provider) {
        send({ type: "text", delta: routed.text });
        send({ type: "done" });
        controller.close();
        return;
      }

      const productIds = [...new Set([...(routed.products ?? []).map((p) => p.id), ...(body.productId ? [body.productId] : [])])];
      const shown = routed.compare
        ? `a comparison table of ${routed.compare.products.map((p) => p.name).join(" vs ")}`
        : routed.products?.length
          ? `${routed.products.length} product card(s): ${routed.products.map((p) => p.name).join("; ")}`
          : "no product cards";
      const routingNote =
        `Beneath your reply the app shows ${shown}. ` +
        (body.productId ? `The shopper opened this chat from the page of product id ${body.productId}. ` : "") +
        `A rule-based draft of the answer (facts are right, wording is clumsy; improve on it, don't repeat it verbatim):\n${routed.text}`;

      let wrote = false;
      try {
        const end = await streamAnswer({
          provider,
          question: message,
          history,
          productIds,
          routingNote,
          onText: (delta) => { wrote = true; send({ type: "text", delta }); },
        });
        if (end === "refused") send({ type: "replace", text: routed.text });
        else if (end === "truncated") send({ type: "text", delta: "…" });
      } catch (err) {
        const detail = err instanceof Anthropic.APIError || err instanceof GeminiError ? `${err.status} ${err.message}` : err;
        console.error(`${provider} request failed:`, detail);
        // Fall back to the grounded rule-based answer so the shopper still gets a reply.
        send({ type: "source", source: "offline" });
        send(wrote ? { type: "replace", text: routed.text } : { type: "text", delta: routed.text });
      }
      send({ type: "done" });
      controller.close();
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store" },
  });
}
