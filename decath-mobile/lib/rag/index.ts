/**
 * Retrieval layer for the shopping assistant.
 *
 * Every product is split into small "chunks" (overview, benefits, each spec, tech Q&A, material).
 * Chunks are scored with BM25 so the assistant can (a) find which products match a request and
 * (b) pull the exact facts that answer a question about one product.
 *
 * This is the "R" of RAG. To add an LLM for the "G", pass `retrieve()` results as context to the
 * model inside lib/rag/assistant.ts — see the note there.
 */
import { products } from "@/lib/products";
import type { Product } from "@/lib/types";

export type Chunk = { id: string; productId: string; kind: string; title: string; text: string };

const SYNONYMS: Record<string, string> = {
  shoe: "shoes", sneaker: "shoes", sneakers: "shoes", footwear: "shoes", trainers: "shoes", run: "running", runner: "running", jogging: "running",
  pant: "pants", trouser: "pants", trousers: "pants", trackpant: "pants", trackpants: "pants", bottoms: "pants", leggings: "pants", capri: "pants", capris: "pants",
  bag: "backpack", bags: "backpack", backpacks: "backpack", rucksack: "backpack", trekking: "hiking", trek: "hiking", hike: "hiking",
  ball: "football", soccer: "football", footballs: "football",
  mats: "mat", racket: "badminton", racquet: "badminton", rackets: "badminton", shuttle: "badminton",
  bike: "cycle", bicycle: "cycle", bikes: "cycle", cycles: "cycle", cycling: "cycle", mtb: "mountain",
  tshirt: "tshirt", tee: "tshirt", tees: "tshirt", shirt: "tshirt", jersey: "tshirt",
  ladies: "women", woman: "women", womens: "women", female: "women", girls: "women", man: "men", mens: "men", male: "men", boys: "men",
  beginner: "beginners", newbie: "beginners", starter: "beginners",
  tshirts: "tshirt", shirts: "tshirt", tops: "tshirt", top: "tshirt",
  cushioning: "cushion", cushioned: "cushion", cushions: "cushion", cushy: "cushion",
  pockets: "pocket", lightweight: "light", lighter: "light", lightest: "light", ultralight: "light",
  waterproofing: "waterproof", breathable: "breathability", breathe: "breathability",
  mountains: "mountain", trails: "trail", offroad: "trail", commuting: "commute", commuter: "commute", office: "commute",
  knee: "knees", joints: "knees", thicker: "thick", thickest: "thick", grippy: "grip", slippery: "grip",
};

const STOP = new Set("a an the and or for to of in on with me i my is are be it this that what which show want need some any please can you do does have has give find looking get best good about how".split(" "));

function baseTokens(s: string): string[] {
  return s
    .toLowerCase()
    .replace(/\bt[- ]?shirts?\b/g, "tshirt")
    .replace(/\bultra[- ]light\b/g, "ultralight")
    .replace(/[^a-z0-9₹ ]+/g, " ")
    .split(/\s+/)
    .filter((t) => t && !STOP.has(t))
    .map((t) => SYNONYMS[t] ?? t);
}

/** Query tokenizer: like baseTokens, plus typo correction against the catalogue vocabulary. */
export function tokenize(s: string): string[] {
  return baseTokens(s).map(correct);
}

// ---- typo correction ("shose" -> "shoes", "bagpack" -> "backpack") ----
let VOCAB: Map<string, number> | null = null;
function vocab() {
  if (!VOCAB) {
    VOCAB = new Map();
    for (const d of docTokens) for (const t of d) VOCAB.set(t, (VOCAB.get(t) ?? 0) + 1);
    for (const v of Object.values(SYNONYMS)) VOCAB.set(v, (VOCAB.get(v) ?? 0) + 50);
  }
  return VOCAB;
}
function editDistance(a: string, b: string, max: number) {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++)
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1) - (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1] ? 1 : 0));
    prev = cur;
  }
  return prev[b.length];
}
export function correct(t: string) {
  const v = vocab();
  if (t.length < 4 || v.has(t) || /\d/.test(t)) return t;
  const max = t.length >= 8 ? 2 : 1;
  let best = t, bestScore = -1;
  for (const [w, n] of v) {
    if (w.length < 3) continue;
    const d = editDistance(t, w, max);
    if (d <= max && n / (d + 1) > bestScore) { best = w; bestScore = n / (d + 1); }
  }
  return best;
}

function productChunks(p: Product): Chunk[] {
  const c: Chunk[] = [];
  const add = (kind: string, title: string, text: string) =>
    c.push({ id: `${p.id}:${c.length}`, productId: p.id, kind, title, text });
  add("overview", "Overview",
    `${p.brand} ${p.name}. Category: ${p.category} (${p.sport}). For ${p.gender}. ${p.breadcrumbs.join(" > ")}. ` +
    `Price ₹${p.price}, MRP ₹${p.mrp}. Rated ${p.rating}/5 from ${p.reviewCount} reviews. ${p.description}`);
  for (const b of p.benefits) add("benefit", b.name, `${b.name}: ${b.value}`);
  for (const s of p.specifications) add("spec", s.name, `${s.name}: ${s.value}`);
  for (const t of p.technicalInformation) add("tech", t.name, `${t.name} ${t.value}`);
  for (const m of p.materialAndCare) add("material", m.name, `${m.name}: ${m.value}`);
  if (p.sizes.length) add("sizes", "Sizes", `Available sizes: ${p.sizes.join(", ")}`);
  add("service", "Warranty & delivery", `Warranty ${p.warrantyYears ?? 1} years. 30 days return and exchange. Made in ${p.madeIn}. ${p.offers.join(". ")}`);
  return c;
}

export const CHUNKS: Chunk[] = products.flatMap(productChunks);

// ---- BM25 ----
const K1 = 1.4, B = 0.75;
const docTokens = CHUNKS.map((c) => baseTokens(`${c.title} ${c.text}`));
const avgLen = docTokens.reduce((s, d) => s + d.length, 0) / docTokens.length;
const df = new Map<string, number>();
for (const d of docTokens) for (const t of new Set(d)) df.set(t, (df.get(t) ?? 0) + 1);
const idf = (t: string) => Math.log(1 + (CHUNKS.length - (df.get(t) ?? 0) + 0.5) / ((df.get(t) ?? 0) + 0.5));

export function retrieve(query: string, opts: { productIds?: string[]; k?: number } = {}) {
  const q = tokenize(query);
  const allow = opts.productIds ? new Set(opts.productIds) : null;
  const scored: { chunk: Chunk; score: number }[] = [];
  CHUNKS.forEach((chunk, i) => {
    if (allow && !allow.has(chunk.productId)) return;
    const d = docTokens[i];
    let score = 0;
    for (const t of q) {
      const tf = d.filter((x) => x === t).length;
      if (!tf) continue;
      score += idf(t) * ((tf * (K1 + 1)) / (tf + K1 * (1 - B + (B * d.length) / avgLen)));
    }
    if (score > 0) scored.push({ chunk, score });
  });
  return scored.sort((a, b) => b.score - a.score).slice(0, opts.k ?? 8);
}

/**
 * Rank products for a query. A product's score is its best chunk plus a little credit for other matching
 * chunks (so long product pages don't win just by having more text), plus a boost when query words appear
 * in the product's own name.
 */
export function rankProducts(query: string, pool?: string[]) {
  const q = tokenize(query);
  const hits = retrieve(query, { productIds: pool, k: 1000 });
  const by = new Map<string, number[]>();
  for (const h of hits) (by.get(h.chunk.productId) ?? by.set(h.chunk.productId, []).get(h.chunk.productId)!).push(h.score);
  const out: { id: string; score: number }[] = [];
  for (const p of products) {
    if (pool && !pool.includes(p.id)) continue;
    const scores = (by.get(p.id) ?? []).sort((a, b) => b - a);
    const nameToks = new Set(baseTokens(`${p.name} ${p.shortName}`));
    const nameBoost = q.reduce((s, t) => s + (nameToks.has(t) ? idf(t) * 1.5 : 0), 0);
    const score = (scores[0] ?? 0) + 0.25 * scores.slice(1, 4).reduce((a, b) => a + b, 0) + nameBoost;
    if (score > 0) out.push({ id: p.id, score });
  }
  return out.sort((a, b) => b.score - a.score);
}
