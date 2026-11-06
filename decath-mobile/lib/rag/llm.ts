/**
 * Generation step of the RAG pipeline: an LLM (Claude or Gemini) writes the reply from retrieved product facts.
 *
 * The routing in ./assistant.ts still decides WHICH products are relevant (and builds the
 * product cards / compare table). This module turns those products plus the top retrieved
 * chunks into a context block and streams the model's answer.
 */
import Anthropic from "@anthropic-ai/sdk";
import { getProduct, inr } from "@/lib/products";
import type { Product } from "@/lib/types";
import { rankProducts, retrieve } from "./index";
import { streamGemini } from "./gemini";

export const MODEL = process.env.CLAUDE_MODEL || "claude-opus-5-5";

export type Provider = "claude" | "gemini";

/**
 * Which LLM writes replies. LLM_PROVIDER=claude|gemini|off picks explicitly; otherwise the first
 * configured key wins (ANTHROPIC_API_KEY, then GEMINI_API_KEY). null = offline rule-based answers.
 */
export function activeProvider(): Provider | null {
  const pick = (process.env.LLM_PROVIDER || "").toLowerCase();
  if (pick === "off" || process.env.ASSISTANT_LLM === "off") return null;
  const hasClaude = Boolean(process.env.ANTHROPIC_API_KEY);
  const hasGemini = Boolean(process.env.GEMINI_API_KEY);
  if (pick === "claude") return hasClaude ? "claude" : null;
  if (pick === "gemini") return hasGemini ? "gemini" : null;
  return hasClaude ? "claude" : hasGemini ? "gemini" : null;
}

let client: Anthropic | null = null;
const getClient = () => (client ??= new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY }));

// Stable across requests so it can be prompt-cached. Keep volatile data (dates, product facts) out of here.
export const SYSTEM = `You are the shopping assistant inside the Decathlon Sports India mobile app.

You answer using ONLY the product facts given in the <catalog_context> block of the latest user message. That block is retrieved from the store catalogue for this question; it is the source of truth.
- Never invent products, prices, specs, sizes, offers, stock or delivery details. If the context doesn't answer the question, say so briefly and suggest what the shopper could ask or browse instead.
- Prices are in Indian rupees; write them like ₹1,299.
- The app already shows tappable product cards (and a comparison table when comparing) under your message. Refer to products by a short name; don't paste URLs or IDs.
- For beginner / fit / use-case questions, reason from the specs (level of practice, fit, material, weight, cushioning, etc.) and say which spec your advice rests on.
- When comparing, give a clear recommendation and the 2-3 differences that matter for the shopper's need.
- This is a chat on a phone: be warm and concise, usually under 120 words. Each product's short name is given as "Short name" in its fact sheet; use it.

Format every reply in this small Markdown style, which the app renders as clean chat UI (follow it exactly):
- Start with one bold title line, e.g. "**4 backpacks**, lightest first 👇" or "**Kipride Max vs Kipcore Premium**".
- List products as a numbered list in the same order as the product cards (numbers match the cards). Put the bold short name on the item line, and the details on the NEXT line indented by three spaces:
1. **MT900 Ultra-light 50L Backpack**
   ₹29,999 · ★ 4.2 (59) · 0.88 kg
- Use "- " bullets with a bold label for facts or differences, e.g. "- **Weight:** about 0.88 kg".
- Put your recommendation (or a tip/offer) on its own line starting with "> ", e.g. "> 💡 **My pick: MT100 50L Backpack**, best value for a 3-day trek."
- Separate sections with a blank line. Use **bold** only for names, labels and key numbers. No tables, no headings (#), no links.
- Our catalogue covers running shoes, yoga pants, yoga mats, trekking backpacks, footballs, badminton rackets, cycles and gym t-shirts. Politely steer unrelated requests back to shopping.`;

function factSheet(p: Product) {
  const kv = (xs: { name: string; value: string }[]) => xs.map((x) => `  - ${x.name}: ${x.value}`).join("\n");
  return [
    `<product id="${p.id}">`,
    `Name: ${p.brand} ${p.name}`,
    `Short name: ${p.shortName}`,
    p.weightKg ? `Weight: about ${p.weightKg} kg` : "",
    `Category: ${p.category} (${p.sport}) · For: ${p.gender}`,
    `Price: ${inr(p.price)}${p.mrp > p.price ? ` (MRP ${inr(p.mrp)}, ${Math.round((1 - p.price / p.mrp) * 100)}% off)` : ""}`,
    `Rating: ${p.reviewCount ? `${p.rating}/5 from ${p.reviewCount} reviews (${p.recommendedCount} recommend it)` : "no reviews yet"}`,
    p.tag ? `Label: ${p.tag}` : "",
    p.sizes.length ? `Sizes: ${p.sizes.join(", ")}` : "",
    `Description: ${p.description}`,
    p.benefits.length ? `Benefits:\n${kv(p.benefits)}` : "",
    p.specifications.length ? `Specifications:\n${kv(p.specifications)}` : "",
    p.materialAndCare.length ? `Material:\n${kv(p.materialAndCare)}` : "",
    p.technicalInformation.length ? `Technical information:\n${kv(p.technicalInformation)}` : "",
    `Warranty: ${p.warrantyYears ?? 1} years · 30-day returns and exchange · Made in ${p.madeIn}`,
    p.offers.length ? `Offers: ${p.offers.join("; ")}` : "",
    `</product>`,
  ].filter(Boolean).join("\n");
}

/** Build the retrieved context: full fact sheets for the chosen products + best-matching chunks elsewhere. */
export function buildContext(question: string, productIds: string[]) {
  let ids = productIds.slice(0, 6);
  if (!ids.length) ids = rankProducts(question).slice(0, 4).map((r) => r.id);
  const sheets = ids.map(getProduct).filter(Boolean).map((p) => factSheet(p!));
  const extra = retrieve(question, { k: 12 })
    .filter((h) => !ids.includes(h.chunk.productId))
    .slice(0, 4)
    .map((h) => {
      const p = getProduct(h.chunk.productId)!;
      return `- [${p.brand} ${p.name}, ${inr(p.price)}] ${h.chunk.text}`;
    });
  return (
    `<catalog_context>\n${sheets.join("\n\n")}` +
    (extra.length ? `\n\nOther possibly relevant catalogue snippets:\n${extra.join("\n")}` : "") +
    `\n</catalog_context>`
  );
}

export type HistoryTurn = { role: "user" | "assistant"; text: string };

/** Streams Claude's reply text. Throws on API errors; returns the stop reason. */
/** How a generation ended: normally, declined by the model's safety layer, or cut off at the length limit. */
export type StreamEnd = "ok" | "refused" | "truncated";

/** Streams the reply from the active provider. Throws on API/network errors. */
export async function streamAnswer(opts: {
  provider: Provider;
  question: string;
  history: HistoryTurn[];
  productIds: string[];
  routingNote: string;
  onText: (delta: string) => void;
}): Promise<StreamEnd> {
  // History must start with a user turn; drop the app's greeting etc.
  const hist = opts.history.slice(-8);
  while (hist.length && hist[0].role !== "user") hist.shift();
  const turns: HistoryTurn[] = [
    ...hist,
    {
      role: "user",
      text:
        `${buildContext(opts.question, opts.productIds)}\n\n` +
        `<app_note>${opts.routingNote}</app_note>\n\n` +
        `Shopper's message: ${opts.question}`,
    },
  ];
  return opts.provider === "gemini"
    ? streamGemini({ system: SYSTEM, turns, onText: opts.onText })
    : streamClaude(turns, opts.onText);
}

async function streamClaude(turns: HistoryTurn[], onText: (d: string) => void): Promise<StreamEnd> {
  const messages: Anthropic.Beta.BetaMessageParam[] = turns.map((t) => ({ role: t.role, content: t.text }));
  const stream = getClient().beta.messages.stream({
    model: MODEL,
    max_tokens: 4000,
    output_config: { effort: "low" }, // chat-style answers; raise if replies feel shallow
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default", // a refused request is retried server-side on Anthropic's recommended model
    system: [{ type: "text", text: SYSTEM, cache_control: { type: "ephemeral" } }],
    messages,
  });

  stream.on("text", (delta) => onText(delta));
  const final = await stream.finalMessage();
  return final.stop_reason === "refusal" ? "refused" : final.stop_reason === "max_tokens" ? "truncated" : "ok";
}
