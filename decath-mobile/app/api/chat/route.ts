import Anthropic from "@anthropic-ai/sdk";
import { respond, type ChatRequest } from "@/lib/rag/assistant";
import { OFF_TOPIC } from "@/lib/rag/answer";
import { verifyGrounding } from "@/lib/rag/grounding";
import { semanticScores } from "@/lib/rag/embeddings";
import { splitQuestions } from "@/lib/rag/questions";
import { rewrite } from "@/lib/rag/rewrite";
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
  const raw = await req.text();
  if (new TextEncoder().encode(raw).length > 32_000) return Response.json({ error: "Chat request is too large" }, { status: 413 });
  const body = (() => { try { return JSON.parse(raw); } catch { return null; } })() as (ChatRequest & { history?: HistoryTurn[] }) | null;
  if (!body || typeof body.message !== "string" || !body.message.trim())
    return Response.json({ error: "message is required" }, { status: 400 });

  const message = body.message.slice(0, 1000);
  const history = (Array.isArray(body.history) ? body.history : [])
    .filter((t) => t && (t.role === "user" || t.role === "assistant") && typeof t.text === "string")
    .slice(-16)
    .map((t) => ({ role: t.role, text: t.text.slice(0, 2000) }));

  const id = (value: unknown) => typeof value === "string" && /^\d{1,20}$/.test(value) ? value : undefined;
  const ids = (value: unknown) => Array.isArray(value) ? value.slice(0, 24).map(id).filter((v): v is string => Boolean(v)) : [];
  const contextIds = ids(body.contextIds), listIds = ids(body.listIds);
  const productId = id(body.productId), lastFocusId = id(body.lastFocusId);
  const denseByQuery = new Map<string, Map<string, number>>();
  if (!OFF_TOPIC.test(message)) {
    await Promise.all(splitQuestions(message).map(async question => {
      const query = rewrite(question, history).query;
      const dense = await semanticScores(query);
      if (dense.scores.size) denseByQuery.set(query, dense.scores);
    }));
  }

  // Retrieval + routing (always runs; picks products and builds cards / compare table)
  const routed = respond({ message, history, contextIds, listIds, lastFocusId, productId }, { semanticForQuery: query => denseByQuery.get(query) });
  const provider = OFF_TOPIC.test(message) || routed.trace?.confident === false ? null : activeProvider();

  const enc = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (o: object) => controller.enqueue(enc.encode(JSON.stringify(o) + "\n"));
      send({ type: "meta", products: routed.products, compare: routed.compare, suggestions: routed.suggestions, action: routed.action, sources: routed.sources, trace: routed.trace, source: provider ?? "rag" });

      if (!provider) {
        send({ type: "text", delta: routed.text });
        send({ type: "done" });
        controller.close();
        return;
      }

      const productIds = [...new Set([...(routed.products ?? []).map((p) => p.id), ...(productId ? [productId] : [])])];
      const shown = routed.compare
        ? `a comparison table of ${routed.compare.products.map((p) => p.name).join(" vs ")}`
        : routed.products?.length
          ? `${routed.products.length} product card(s): ${routed.products.map((p) => p.name).join("; ")}`
          : "no product cards";
      const routingNote =
        `Beneath your reply the app shows ${shown}. ` +
        (productId ? `The shopper opened this chat from the page of product id ${productId}. ` : "") +
        `A rule-based draft of the answer (facts are right, wording is clumsy; improve on it, don't repeat it verbatim):\n${routed.text}`;

      let wrote = false;
      let full = "";
      const grounded = Boolean(routed.sources?.length && routed.passages?.length);
      // Give a useful, source-backed answer immediately while optional prose refinement runs.
      if (grounded) { send({ type: "text", delta: routed.text }); wrote = true; }
      try {
        const end = await streamAnswer({
          provider,
          question: message,
          history,
          productIds,
          routingNote,
          knowledge: grounded ? routed.passages : undefined,
          // Source-based prose is buffered until checked, so unsupported claims never flash in the UI.
          onText: (delta) => { full += delta; if (!grounded) { wrote = true; send({ type: "text", delta }); } },
        });
        if (end === "refused") send({ type: "replace", text: routed.text });
        else {
          if (grounded) {
            const checked = verifyGrounding(full, routed.passages!);
            if (end !== "truncated" && checked.supported) send({ type: "replace", text: full });
          } else if (end === "truncated") send({ type: "text", delta: "…" });
        }
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
