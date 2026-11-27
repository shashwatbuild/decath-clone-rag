/**
 * Grounded, cited answers for knowledge questions ("how do I choose a racket?", "feather or plastic?",
 * "what is your return policy?").
 *
 *   rewrite the question  ->  hybrid search  ->  is the evidence good enough?  ->  pick the best sentences
 *   ->  answer with numbered citations [1] [2]  ->  show the sources and how they were found
 *
 * Every sentence in the reply is copied from a retrieved passage, so nothing is invented. When the evidence
 * is weak the function returns null and the assistant falls back to its other skills or says it doesn't know.
 * The same sources are handed to an LLM (when one is configured) with an instruction to cite only them.
 */
import { products, toLite } from "@/lib/products";
import type { ProductLite, RagTrace, Source } from "@/lib/types";
import { baseTokens, tokenize } from "./index";
import { confident, coverage, search, stem, type Hit } from "./hybrid";
import { KNOWLEDGE } from "./knowledge";
import { rewrite, type Turn } from "./rewrite";
import { splitQuestions } from "./questions";

export type KnowledgeAnswer = {
  text: string;
  products: ProductLite[];
  suggestions: string[];
  sources: Source[];
  trace: RagTrace;
  /** the passages behind the sources, in source order, for an LLM to rephrase */
  passages: { n: number; title: string; text: string }[];
};

/** Questions that have nothing to do with shopping for sport; answering them from product text would be wrong. */
export const OFF_TOPIC = /\b(who won|who is the (president|prime minister)|weather|news|stock price|share price|bitcoin|crypto|recipe|movie|song lyrics|joke|poem|horoscope|election|capital of)\b/i;

const KNOW = new Map(KNOWLEDGE.map((k) => [k.id, k]));
const product = (id: string) => products.find((p) => p.id === id);

const tidy = (s: string) => s.replace(/^[-•*\s]+/, "").replace(/\s+/g, " ").trim();
/** Sentences and bullet lines of a passage, cleaned of stray bullets and tabs. */
const sentences = (text: string) =>
  text.split(/\n+|(?<=[.!?])\s+/).map(tidy).filter((s) => s.length > 12 && !/^[\w &/()-]{1,30}:\s*\S{1,25}$/.test(s));

/** The sentences of a passage that best answer the query, in their original order. */
function bestSentences(text: string, want: Set<string>, max: number, fill = false): string[] {
  const all = sentences(text);
  if (!all.length) return [];
  const scored = all.map((s, i) => {
    const toks = new Set(baseTokens(s).map(stem));
    let hit = 0;
    for (const t of want) if (toks.has(t)) hit++;
    return { s, i, score: hit + (i === 0 ? 0.3 : 0) };
  });
  const keep = scored.filter((x) => x.score >= 1).sort((a, b) => b.score - a.score).slice(0, max);
  // When one short source carries the whole answer, top up with its next sentences so nothing important is cut
  if (fill) {
    // always open with the passage's first sentence (it frames the answer), then top up
    if (!keep.includes(scored[0])) { if (keep.length >= max) keep.pop(); keep.push(scored[0]); }
    for (const x of scored) if (keep.length < max && !keep.includes(x)) keep.push(x);
  }
  return (keep.length ? keep : scored.slice(0, 1)).sort((a, b) => a.i - b.i).map((x) => x.s);
}

const popularity = (p: { rating: number; reviewCount: number }) => p.rating * Math.log10(p.reviewCount + 10);

export type AnswerOptions = { focusName?: string; semanticForQuery?: (query: string) => Map<string, number> | undefined };

export function knowledgeAnswer(message: string, history: Turn[], opts: AnswerOptions = {}): KnowledgeAnswer | null {
  if (OFF_TOPIC.test(message)) return null;
  const questions = splitQuestions(message);
  if (questions.length === 1) return singleAnswer(message, history, opts);
  const answers = questions.map(q => singleAnswer(q, history, opts));
  const found = answers.filter((a): a is KnowledgeAnswer => Boolean(a));
  if (!found.length) return null;
  const sources: Source[] = [], passages: KnowledgeAnswer["passages"] = [];
  const sections = answers.map((answer, i) => {
    if (!answer) return `**${questions[i]}**\n\nI couldn't find enough catalogue evidence to answer this part.`;
    const numbers = new Map<number, number>();
    for (const source of answer.sources) {
      let target = sources.find(s => s.id === source.id);
      if (!target) { target = { ...source, n: sources.length + 1 }; sources.push(target); }
      numbers.set(source.n, target.n);
      const passage = answer.passages.find(p => p.n === source.n);
      if (passage) {
        const existing = passages.find(p => p.n === target.n);
        if (existing) { if (!existing.text.includes(passage.text)) existing.text += `\n${passage.text}`; }
        else passages.push({ ...passage, n: target.n });
      }
    }
    const bullets = answer.text.split('\n').filter(l => l.startsWith('- ')).slice(0, 3).join('\n').replace(/\[(\d+)\]/g, (_, n) => `[${numbers.get(Number(n))}]`);
    return `**${questions[i]}**\n\n${bullets}`;
  });
  return { text: sections.join('\n\n'), sources, passages, products: [...new Map(found.flatMap(a => a.products).map(p => [p.id, p])).values()].slice(0, 4), suggestions: [...new Set(found.flatMap(a => a.suggestions))].slice(0, 3), trace: { ...found[0].trace, query: message, rewritten: questions.join(' | '), confident: found.length === questions.length, notes: [...found[0].trace.notes, `Answered ${found.length} of ${questions.length} explicit questions from evidence`], stages: ['Decompose explicit questions', ...found[0].trace.stages], top: found.flatMap(a => a.trace.top).slice(0, 5) } };
}

function singleAnswer(message: string, history: Turn[], opts: AnswerOptions): KnowledgeAnswer | null {
  if (OFF_TOPIC.test(message)) return null;
  const rw = rewrite(message, history, opts.focusName);
  const { hits, trace } = search(rw.query, { k: 6, intent: rw.intent, topic: rw.topic || undefined, semantic: opts.semanticForQuery?.(rw.query) });
  const ok = confident(hits, trace);
  const ragTrace: RagTrace = { query: message, rewritten: rw.query, notes: rw.notes, stages: trace.stages, top: trace.top, confident: ok };
  if (!ok) return null;

  // Only answer from knowledge: a guide, a policy, or a product's own written guide. A bare spec line
  // ("Drop: 8 mm") is not an explanation, so those questions go to the product search instead.
  const isKnowledge = (h: Hit) => h.doc.source === "knowledge" || h.doc.kind === "guide";
  if (!hits.slice(0, 3).some(isKnowledge)) {
    ragTrace.confident = false;
    return null;
  }
  const leadKnowledge = hits[0].doc.source === "knowledge";

  // Group passages by source. Keep sources that are nearly as relevant as the best one, and when a guide or
  // policy leads, don't pad the answer with product spec fragments (those show up as product cards instead).
  const bySource = new Map<string, Hit[]>();
  for (const h of hits) {
    if (h.score < 0.6 * hits[0].score) continue;
    if (leadKnowledge && !isKnowledge(h)) continue;
    (bySource.get(h.doc.ref) ?? bySource.set(h.doc.ref, []).get(h.doc.ref)!).push(h);
  }
  // The lead source always stays. Others must individually cover most of what was asked.
  const refs = [...bySource.keys()]
    .filter((ref, i) => i === 0 || (bySource.get(ref)![0].score >= 0.7 * hits[0].score && coverage(trace.tokens, bySource.get(ref)!.map((h) => `${h.doc.title} ${h.doc.text}`).join(" ")) >= 0.85))
    .slice(0, 3);
  const want = new Set(tokenize(rw.query).map(stem).filter((t) => t.length > 2));

  const sources: Source[] = [];
  const passages: KnowledgeAnswer["passages"] = [];
  const lines: string[] = [];
  refs.forEach((ref, i) => {
    const n = i + 1;
    const group = bySource.get(ref)!;
    const first = group[0].doc;
    const k = KNOW.get(ref);
    const p = k ? undefined : product(ref);
    const title = k ? k.title : p ? `${p.shortName}: ${first.title}` : first.title;
    // Retrieve small passages, then restore their bounded parent guide for answer construction.
    // This preserves qualifications in neighbouring paragraphs instead of quoting an isolated fragment.
    const pool = k ? k.text.slice(0, 6000) : group.map((g) => g.doc.text).join(" ").slice(0, 6000);
    const picked = bestSentences(pool, want, refs.length === 1 ? 5 : 2, refs.length === 1 && Boolean(k));
    if (!picked.length) return;
    sources.push({ n, id: ref, title, kind: k ? k.kind : "product", url: k ? `/guides/${ref}` : `/p/${ref}`, snippet: picked[0] });
    passages.push({ n, title, text: pool });
    for (const s of picked) lines.push(`- ${s.replace(/\.$/, "")} [${n}]`);
  });
  if (!sources.length) return null;
  if (sources.some(s => KNOW.has(s.id))) ragTrace.stages.push("Restore bounded parent-guide context");

  // Related products: the categories the main source is about
  const main = KNOW.get(sources[0].id);
  const cats = main?.categories ?? (main ? [] : [...new Set(hits.filter((h) => h.doc.source === "product").map((h) => product(h.doc.ref)?.category).filter(Boolean) as string[])]);
  const related = products.filter((p) => cats.includes(p.category) && p.inStock).sort((a, b) => popularity(b) - popularity(a)).slice(0, 4);

  const headline = main ? main.title : sources[0].title;
  const text =
    `**${headline}**\n\n${lines.join("\n")}` +
    (related.length ? `\n\n> 💡 Want to see options? Here are the best-rated ones below.` : "");

  const suggest = main?.suggest ?? (rw.topic === "badminton" ? ["Help me build a badminton kit"] : rw.topic === "running" ? ["Help me build a marathon kit"] : []);
  return { text, products: related.map(toLite), suggestions: [...suggest, "What's on sale?"].slice(0, 3), sources, trace: ragTrace, passages };
}

/** Keep only citations that point at a real source, so a model can't cite something that was never retrieved. */
export function validCitations(text: string, sourceCount: number): string {
  return text.replace(/\[(\d+)\]/g, (m, n) => (Number(n) >= 1 && Number(n) <= sourceCount ? m : ""));
}
