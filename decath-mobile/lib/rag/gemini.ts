/**
 * Gemini provider for the generation step, using the Gemini REST API's streaming endpoint
 * (POST models/{model}:streamGenerateContent?alt=sse). No SDK needed.
 */
import type { HistoryTurn, StreamEnd } from "./llm";

/** Models to try in order (comma-separated GEMINI_MODELS overrides). Busy/unavailable models fall through to the next. */
export const GEMINI_MODELS = (process.env.GEMINI_MODELS || process.env.GEMINI_MODEL || "gemini-3.8-flash,gemini-flash-latest")
  .split(",")
  .map((m) => m.trim())
  .filter(Boolean);
/** Total time we let the shopper wait for Gemini's first words, across all models/retries (it can queue for 60-90s when busy). */
const BUDGET_MS = Number(process.env.GEMINI_TIMEOUT_MS || 12_000);
/** After Gemini fails, answer offline straight away for this long instead of making every shopper wait. */
const COOLDOWN_MS = 2 * 60_000;
let coolingUntil = 0;

/** True while Gemini is in cooldown after recent failures (the route answers offline instantly). */
export const geminiCoolingDown = () => Date.now() < coolingUntil;
/** Hard cap on one whole reply. */
const TOTAL_MS = 60_000;
const BASE = process.env.GEMINI_BASE_URL || "https://generativelanguage.googleapis.com/v1beta";

type Part = { text?: string; thought?: boolean };
type Chunk = {
  candidates?: { content?: { parts?: Part[] }; finishReason?: string }[];
  promptFeedback?: { blockReason?: string };
  error?: { code: number; message: string; status: string };
};

export class GeminiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

type Opts = { system: string; turns: HistoryTurn[]; onText: (delta: string) => void };

/** Overloaded, rate-limited, unavailable or too slow: worth trying the next model. */
const retryable = (e: unknown) => e instanceof GeminiError && (e.status === 0 || e.status === 404 || e.status === 408 || e.status === 429 || e.status >= 500);

export async function streamGemini(opts: Opts): Promise<StreamEnd> {
  if (geminiCoolingDown()) throw new GeminiError(503, "Gemini skipped: busy recently, retrying after cooldown");
  const deadline = Date.now() + BUDGET_MS;
  // Each model gets one quick retry, since Gemini's "high demand" 503s often clear within a second or two.
  const attempts = GEMINI_MODELS.flatMap((m) => [m, m]);
  let lastErr: unknown;
  for (const [i, model] of attempts.entries()) {
    const left = deadline - Date.now();
    if (left < 1500) break;
    let wrote = false;
    try {
      const end = await streamOnce(model, { ...opts, onText: (d) => { wrote = true; opts.onText(d); } }, left);
      coolingUntil = 0;
      return end;
    } catch (e) {
      lastErr = e;
      // Can't switch models halfway through an answer; and a bad key / bad request won't fix itself.
      if (wrote || !retryable(e)) throw e;
      console.warn(`gemini ${model} attempt ${i + 1} failed (${e instanceof GeminiError ? `${e.status} ${e.message}` : e})`);
      if (e instanceof GeminiError && e.status === 503) await new Promise((r) => setTimeout(r, 800));
    }
  }
  coolingUntil = Date.now() + COOLDOWN_MS;
  throw lastErr ?? new GeminiError(0, "no time left for Gemini");
}

async function streamOnce(model: string, opts: Opts, firstTokenMs: number): Promise<StreamEnd> {
  const ctrl = new AbortController();
  let firstToken = false;
  const firstTimer = setTimeout(() => { if (!firstToken) ctrl.abort("first-token timeout"); }, firstTokenMs);
  const totalTimer = setTimeout(() => ctrl.abort("total timeout"), TOTAL_MS);
  const onText = (d: string) => { firstToken = true; opts.onText(d); };
  try {
    return await request(model, opts, onText, ctrl.signal);
  } catch (e) {
    if (ctrl.signal.aborted) throw new GeminiError(0, `no reply from ${model} within ${Math.round((firstToken ? TOTAL_MS : firstTokenMs) / 1000)}s`);
    throw e;
  } finally {
    clearTimeout(firstTimer);
    clearTimeout(totalTimer);
  }
}

async function request(model: string, opts: Opts, onText: (d: string) => void, signal: AbortSignal): Promise<StreamEnd> {
  const res = await fetch(`${BASE}/models/${model}:streamGenerateContent?alt=sse`, {
    signal,
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": process.env.GEMINI_API_KEY ?? "" },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: opts.system }] },
      // Gemini calls the assistant role "model"
      contents: opts.turns.map((t) => ({ role: t.role === "assistant" ? "model" : "user", parts: [{ text: t.text }] })),
      // Low thinking: chat answers from given facts don't need deep reasoning, and the first words arrive sooner.
      generationConfig: { maxOutputTokens: 4000, thinkingConfig: { thinkingLevel: process.env.GEMINI_THINKING || "low" } },
    }),
  });

  if (!res.ok || !res.body) {
    const body = await res.text().catch(() => "");
    let msg = body.slice(0, 300) || res.statusText;
    try {
      msg = (JSON.parse(body) as Chunk).error?.message ?? msg;
    } catch {}
    throw new GeminiError(res.status, msg || `HTTP ${res.status} from ${model}`);
  }

  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = "";
  let finish: string | undefined;
  let blocked = false;

  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    const lines = buf.split("\n");
    buf = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.startsWith("data:")) continue;
      const chunk = JSON.parse(line.slice(5)) as Chunk;
      if (chunk.error) throw new GeminiError(chunk.error.code, chunk.error.message);
      if (chunk.promptFeedback?.blockReason) blocked = true;
      const cand = chunk.candidates?.[0];
      for (const p of cand?.content?.parts ?? []) if (p.text && !p.thought) onText(p.text);
      if (cand?.finishReason) finish = cand.finishReason;
    }
  }

  if (blocked || (finish && ["SAFETY", "PROHIBITED_CONTENT", "BLOCKLIST", "SPII", "RECITATION"].includes(finish))) return "refused";
  if (finish === "MAX_TOKENS") return "truncated";
  return "ok";
}
