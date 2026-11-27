/**
 * Hybrid retrieval over products AND the knowledge base.
 *
 *   1. BM25 keyword search                      exact words, rare words weigh more
 *   2. Character n-gram TF-IDF search           typos, plurals, word forms ("shuttlecok", "racquets")
 *   3. Pseudo-relevance feedback (query expansion)  re-search with the best terms of the top hits
 *   4. Reciprocal Rank Fusion of the three lists
 *   5. Rerank: title and phrase matches, topic, document type, popularity
 *   6. MMR selection: relevant but not repetitive, at most two passages per source
 *
 * Everything runs offline in milliseconds, so it works with or without an LLM. Each hit carries the scores
 * from every stage, so an answer can show how it was found.
 */
import { products } from "@/lib/products";
import { CHUNKS, baseTokens, tokenize } from "./index";
import { KNOWLEDGE } from "./knowledge";

export type Doc = {
  id: string;
  source: "product" | "knowledge";
  /** overview | benefit | spec | tech | guide | material | sizes | service (products); policy | guide (knowledge) */
  kind: string;
  title: string;
  text: string;
  /** what a citation points at: a product id or a knowledge document id */
  ref: string;
  topic: string;
};

export type Hit = {
  doc: Doc;
  /** final score after reranking (higher is better) */
  score: number;
  parts: { bm25: number; ngram: number; expanded: number; fused: number; semantic?: number };
};

export type Trace = {
  query: string;
  tokens: string[];
  expansion: string[];
  stages: string[];
  top: { id: string; title: string; bm25: number; ngram: number; fused: number; score: number }[];
};

export type SearchOptions = {
  k?: number;
  source?: "product" | "knowledge";
  productIds?: string[];
  /** documents about this topic ("badminton", "running"…) are preferred */
  topic?: string;
  /** "howto" prefers guides and policies; "fact" prefers specs and benefits */
  intent?: "howto" | "fact";
  expand?: boolean;
  /** Trusted server-side dense retrieval scores, never accepted from a chat request. */
  semantic?: Map<string, number>;
};

// ------------------------------------------------------------------ the corpus

const productTopic = new Map(products.map((p) => [p.id, p.sport.toLowerCase()]));

function buildDocs(): Doc[] {
  const docs: Doc[] = CHUNKS.map((c) => ({
    id: c.id,
    source: "product" as const,
    // long "technical information" entries are really short guides ("How to choose the right yoga pants?")
    kind: c.kind === "tech" && c.text.length > 150 ? "guide" : c.kind,
    title: c.title,
    text: c.text,
    ref: c.productId,
    topic: productTopic.get(c.productId) ?? "",
  }));
  for (const k of KNOWLEDGE)
    k.text.split(/\n\s*\n/).forEach((para, i) =>
      docs.push({ id: `${k.id}#${i}`, source: "knowledge", kind: k.kind, title: k.title, text: para.trim(), ref: k.id, topic: k.topic }),
    );
  return docs;
}

// ------------------------------------------------------------------ indexes (built on first use)

type Posting = [number, number][];
type Index = {
  docs: Doc[];
  toks: Set<string>[];
  len: number[];
  avg: number;
  bm: { post: Map<string, Posting>; idf: Map<string, number> };
  ng: { post: Map<string, Posting>; idf: Map<string, number>; norm: number[] };
  pop: Map<string, number>;
};

const K1 = 1.4, B = 0.75;

/** Light plural stemming, used only inside this index ("returns" = "return", "batteries" = "battery"). */
export const stem = (t: string) =>
  t.length > 4 && t.endsWith("ies") ? `${t.slice(0, -3)}y`
  : t.length > 5 && t.endsWith("ing") ? t.slice(0, -3)
  : t.length > 3 && t.endsWith("s") && !/(ss|us|is)$/.test(t) ? t.slice(0, -1)
  : t;
const grams = (t: string) => {
  const s = `^${t}$`, out: string[] = [];
  for (let i = 0; i + 3 <= s.length; i++) out.push(s.slice(i, i + 3));
  return out;
};

let INDEX: Index | null = null;
function index(): Index {
  if (INDEX) return INDEX;
  const docs = buildDocs();
  const N = docs.length;
  const tokens = docs.map((d) => baseTokens(`${d.title} ${d.text}`).map(stem));
  const len = tokens.map((t) => t.length);
  const avg = len.reduce((a, b) => a + b, 0) / N;

  const bmPost = new Map<string, Posting>();
  tokens.forEach((ts, i) => {
    const tf = new Map<string, number>();
    for (const t of ts) tf.set(t, (tf.get(t) ?? 0) + 1);
    for (const [t, n] of tf) (bmPost.get(t) ?? bmPost.set(t, []).get(t)!).push([i, n]);
  });
  const bmIdf = new Map<string, number>();
  for (const [t, p] of bmPost) bmIdf.set(t, Math.log(1 + (N - p.length + 0.5) / (p.length + 0.5)));

  const ngCounts = tokens.map((ts) => {
    const c = new Map<string, number>();
    for (const t of new Set(ts)) for (const g of grams(t)) c.set(g, (c.get(g) ?? 0) + 1);
    return c;
  });
  const ngDf = new Map<string, number>();
  for (const c of ngCounts) for (const g of c.keys()) ngDf.set(g, (ngDf.get(g) ?? 0) + 1);
  const ngIdf = new Map<string, number>();
  for (const [g, d] of ngDf) ngIdf.set(g, Math.log(1 + N / d));
  const ngPost = new Map<string, Posting>();
  const norm = new Array<number>(N).fill(0);
  ngCounts.forEach((c, i) => {
    let sq = 0;
    for (const [g, n] of c) {
      const w = (1 + Math.log(n)) * ngIdf.get(g)!;
      sq += w * w;
      (ngPost.get(g) ?? ngPost.set(g, []).get(g)!).push([i, w]);
    }
    norm[i] = Math.sqrt(sq) || 1;
  });

  const pop = new Map<string, number>();
  const maxPop = Math.max(...products.map((p) => p.rating * Math.log10(p.reviewCount + 10)), 1);
  for (const p of products) pop.set(p.id, (p.rating * Math.log10(p.reviewCount + 10)) / maxPop);

  return (INDEX = { docs, toks: tokens.map((t) => new Set(t)), len, avg, bm: { post: bmPost, idf: bmIdf }, ng: { post: ngPost, idf: ngIdf, norm }, pop });
}

/** All documents (for evaluation and the guide pages). */
export const allDocs = () => index().docs;

// ------------------------------------------------------------------ the retrievers

type Allow = (d: Doc) => boolean;

function bm25(ix: Index, terms: Map<string, number>, allow: Allow): Map<number, number> {
  const scores = new Map<number, number>();
  for (const [t, w] of terms) {
    const post = ix.bm.post.get(t);
    if (!post) continue;
    const idf = ix.bm.idf.get(t)!;
    for (const [i, tf] of post) {
      if (!allow(ix.docs[i])) continue;
      const s = w * idf * ((tf * (K1 + 1)) / (tf + K1 * (1 - B + (B * ix.len[i]) / ix.avg)));
      scores.set(i, (scores.get(i) ?? 0) + s);
    }
  }
  return scores;
}

function ngramCosine(ix: Index, query: string[], allow: Allow): Map<number, number> {
  const qv = new Map<string, number>();
  for (const t of new Set(query)) for (const g of grams(t)) qv.set(g, (qv.get(g) ?? 0) + 1);
  let qsq = 0;
  const qw = new Map<string, number>();
  for (const [g, n] of qv) {
    const w = (1 + Math.log(n)) * (ix.ng.idf.get(g) ?? Math.log(1 + ix.docs.length));
    qw.set(g, w);
    qsq += w * w;
  }
  const qn = Math.sqrt(qsq) || 1;
  const dots = new Map<number, number>();
  for (const [g, w] of qw) {
    const post = ix.ng.post.get(g);
    if (!post) continue;
    for (const [i, dw] of post) if (allow(ix.docs[i])) dots.set(i, (dots.get(i) ?? 0) + w * dw);
  }
  const out = new Map<number, number>();
  for (const [i, d] of dots) out.set(i, d / (qn * ix.ng.norm[i]));
  return out;
}

const ranked = (m: Map<number, number>, n = 60) => [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, n);

/** Terms that characterise the top documents but are not in the query yet (pseudo-relevance feedback). */
function expansionTerms(ix: Index, top: number[], query: Set<string>, max = 6): string[] {
  const weight = new Map<string, number>();
  top.forEach((i, rank) => {
    const decay = 1 / (1 + rank);
    for (const t of ix.toks[i]) {
      if (query.has(t) || t.length < 3 || /\d/.test(t)) continue;
      weight.set(t, (weight.get(t) ?? 0) + decay * (ix.bm.idf.get(t) ?? 0));
    }
  });
  return [...weight.entries()].sort((a, b) => b[1] - a[1]).slice(0, max).map(([t]) => t);
}

const jaccard = (a: Set<string>, b: Set<string>) => {
  let inter = 0;
  for (const t of a) if (b.has(t)) inter++;
  return inter / (a.size + b.size - inter || 1);
};

/** Plain BM25 (the old behaviour), kept so evaluation can show what the extra stages add. */
export function bm25Search(query: string, k = 8, opts: Pick<SearchOptions, "source" | "productIds"> = {}) {
  const ix = index();
  const allow = allowFor(opts);
  const terms = new Map<string, number>();
  for (const t of tokenize(query).map(stem)) terms.set(t, 1);
  return ranked(bm25(ix, terms, allow), k).map(([i, s]) => ({ doc: ix.docs[i], score: s }));
}

function allowFor(opts: Pick<SearchOptions, "source" | "productIds">): Allow {
  const ids = opts.productIds ? new Set(opts.productIds) : null;
  return (d) => (!opts.source || d.source === opts.source) && (!ids || d.source !== "product" || ids.has(d.ref));
}

// ------------------------------------------------------------------ the full search

export function search(query: string, opts: SearchOptions = {}): { hits: Hit[]; trace: Trace } {
  const ix = index();
  const k = opts.k ?? 6;
  const allow = allowFor(opts);
  const qTokens = tokenize(query).map(stem); // typo-corrected, for keyword search
  const qRaw = baseTokens(query); // as typed, for fuzzy matching
  const qSet = new Set(qTokens);

  // 1 + 2: keyword and fuzzy retrieval
  const bmScores = bm25(ix, new Map(qTokens.map((t) => [t, 1])), allow);
  const ngScores = ngramCosine(ix, qRaw, allow);

  // 3: query expansion from the best first-pass documents
  const first = ranked(bmScores, 3).map(([i]) => i);
  const firstScore = ranked(bmScores, 1)[0]?.[1] ?? 0;
  const expansion = opts.expand === false || firstScore < 4 ? [] : expansionTerms(ix, first, qSet);
  const expScores = expansion.length
    ? bm25(ix, new Map<string, number>([...qTokens.map((t): [string, number] => [t, 1]), ...expansion.map((t): [string, number] => [t, 0.4])]), allow)
    : new Map<number, number>();

  // 4: reciprocal rank fusion
  const fused = new Map<number, number>();
  const fuse = (list: [number, number][], weight: number) => list.forEach(([i], r) => fused.set(i, (fused.get(i) ?? 0) + weight / (60 + r + 1)));
  fuse(ranked(bmScores), 1);
  fuse(ranked(ngScores), 0.7);
  fuse(ranked(expScores), 0.6);
  const dense = new Map<number, number>();
  if (opts.semantic) ix.docs.forEach((d, i) => {
    const score = opts.semantic!.get(d.id);
    if (score !== undefined && Number.isFinite(score) && score >= .25 && allow(d)) dense.set(i, score);
  });
  fuse(ranked(dense), .9);
  // Explanation questions also search the guides and policies on their own, so thousands of tiny product
  // chunks (every product has a "Size" line) can't crowd them out of the candidate pool.
  if (opts.intent === "howto" && !opts.source) {
    const kn = bm25(ix, new Map(qTokens.map((t) => [t, 1])), (d) => d.source === "knowledge" && allow(d));
    fuse(ranked(kn, 15), 0.8);
  }
  const cand = ranked(fused, 30);
  const topFused = cand[0]?.[1] ?? 1;

  // 5: rerank
  const titleTok = (i: number) => new Set(baseTokens(ix.docs[i].title).map(stem));
  const text = (i: number) => ix.docs[i].text.toLowerCase();
  const bigrams = qTokens.slice(0, -1).map((t, j) => `${t} ${qTokens[j + 1]}`);
  const scored = cand.map(([i, f]) => {
    const d = ix.docs[i];
    let s = f / topFused;
    const tt = titleTok(i);
    s += 0.25 * (qTokens.length ? qTokens.filter((t) => tt.has(t)).length / qTokens.length : 0);
    if (bigrams.some((b) => text(i).includes(b))) s += 0.12;
    if (opts.topic && d.topic === opts.topic) s += 0.25;
    if (opts.intent === "howto") s += d.source === "knowledge" ? 0.4 : d.kind === "guide" ? 0.1 : 0;
    if (opts.intent === "fact" && (d.kind === "spec" || d.kind === "benefit")) s += 0.1;
    if (d.source === "product") s += 0.05 * (ix.pop.get(d.ref) ?? 0);
    return { i, s, f };
  }).sort((a, b) => b.s - a.s);

  // 6: MMR with a per-source cap
  const picked: typeof scored = [];
  const perRef = new Map<string, number>();
  while (picked.length < k && scored.length) {
    let bestIdx = -1, best = -Infinity;
    scored.forEach((c, n) => {
      const ref = ix.docs[c.i].ref;
      if ((perRef.get(ref) ?? 0) >= 2) return;
      const redundancy = picked.length ? Math.max(...picked.map((p) => jaccard(ix.toks[c.i], ix.toks[p.i]))) : 0;
      const mmr = 0.75 * c.s - 0.25 * redundancy;
      if (mmr > best) { best = mmr; bestIdx = n; }
    });
    if (bestIdx < 0) break;
    const [c] = scored.splice(bestIdx, 1);
    picked.push(c);
    perRef.set(ix.docs[c.i].ref, (perRef.get(ix.docs[c.i].ref) ?? 0) + 1);
  }

  const hits: Hit[] = picked.map((c) => ({
    doc: ix.docs[c.i],
    score: c.s,
    parts: { bm25: bmScores.get(c.i) ?? 0, ngram: ngScores.get(c.i) ?? 0, expanded: expScores.get(c.i) ?? 0, fused: c.f, ...(dense.has(c.i) ? { semantic: dense.get(c.i) } : {}) },
  }));
  const trace: Trace = {
    query,
    tokens: qTokens,
    expansion,
    stages: ["Keyword search (BM25)", "Fuzzy match (character n-grams)", ...(dense.size ? ["Dense semantic retrieval (local embeddings)"] : []), expansion.length ? `Query expansion (+${expansion.length} terms)` : "Query expansion (nothing to add)", "Rank fusion", "Rerank and de-duplicate"],
    top: hits.slice(0, 5).map((h) => ({ id: h.doc.id, title: h.doc.title, bm25: round(h.parts.bm25), ngram: round(h.parts.ngram), fused: round(h.parts.fused * 100), score: round(h.score) })),
  };
  return { hits, trace };
}

const round = (n: number) => Math.round(n * 100) / 100;

/**
 * Is the evidence good enough to answer from? Uses the raw keyword and fuzzy scores of the best hit, not the
 * fused rank (which is always relative). A weak match means the assistant should say it doesn't know.
 */
export function confident(hits: Hit[], trace: Trace): boolean {
  const top = hits[0];
  if (!top) return false;
  if (!(top.parts.bm25 >= 4 || top.parts.ngram >= 0.4 || (top.parts.semantic ?? 0) >= .7)) return false;
  // Coverage: how many of the question's content words appear in the best three passages?
  const want = trace.tokens.filter((t) => t.length > 2 && !GENERIC.has(t));
  if (!want.length) return false;
  const have = new Set(hits.slice(0, 3).flatMap((h) => baseTokens(`${h.doc.title} ${h.doc.text}`).map(stem)));
  const overlap = want.filter((t) => have.has(t)).length / want.length;
  return overlap >= 0.5 || ((top.parts.semantic ?? 0) >= .7 && overlap >= .25);
}

/**
 * How much of the question a passage covers, weighting rare words more ("drop" counts for more than "shoes").
 * Used to keep secondary sources honest: a passage that only shares a common word is not evidence.
 */
export function coverage(queryTokens: string[], text: string): number {
  const ix = index();
  const have = new Set(baseTokens(text).map(stem));
  let total = 0, got = 0;
  for (const t of new Set(queryTokens)) {
    if (t.length < 3 || GENERIC.has(t)) continue;
    const w = ix.bm.idf.get(t) ?? 1;
    total += w;
    if (have.has(t)) got += w;
  }
  return total ? got / total : 0;
}

/** Question words that say nothing about the topic. */
const GENERIC = new Set("who won win would will there their them they than then get got make take use used using tell know mean means like one two new many much need".split(" "));
