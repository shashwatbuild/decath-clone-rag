import { search } from "../rag/hybrid";
import { KNOWLEDGE } from "../rag/knowledge";
import { getProduct } from "../products";
import type { LabInput, LabPassage } from "./types";

/** Query decomposition + reciprocal-rank fusion over the existing sparse/fuzzy hybrid retriever.
 * User observations stay structured and separate: they are never indexed as catalogue truth.
 */
export function retrieveLab(input: LabInput, ids: string[]) {
  const queries = [...new Set([
    `${input.goal} ${input.query}`,
    `how to choose ${input.goal} gear for ${input.level}`,
    ...(input.rain ? [`${input.goal} waterproof rain cover care`] : []),
    ...(input.longSession ? [`${input.goal} long distance hydration capacity`] : []),
    ...(input.gear.length ? [`${input.goal} maintenance material care repair`] : []),
  ])].slice(0, 5);
  const fused = new Map<string, { hit: ReturnType<typeof search>["hits"][number]; score: number; queries: Set<number> }>();
  const topic = input.goal === "trekking" ? "hiking" : input.goal;
  const wantsPolicy = /return|delivery|coupon|payment|warranty/i.test(input.query);
  queries.forEach((q, n) => {
    const hits = search(q, { k: 12, topic: input.goal === "trekking" ? "hiking" : input.goal, intent: "howto" }).hits;
    const focused = ids.length ? search(q, { k: 8, source: "product", productIds: ids }).hits : [];
    for (const [rank, hit] of [...focused, ...hits].filter(hit => hit.doc.topic === topic || hit.doc.topic === input.goal || (wantsPolicy && hit.doc.topic === "store")).entries()) {
      const previous = fused.get(hit.doc.id);
      if (previous) { if (!previous.queries.has(n)) previous.score += 1 / (60 + rank + 1); previous.queries.add(n); }
      else fused.set(hit.doc.id, { hit, score: 1 / (61 + rank), queries: new Set([n]) });
    }
  });
  const count = new Map<string, number>();
  const sources: LabPassage[] = [];
  const ranked = [...fused.values()].sort((a, b) => b.score - a.score);
  // Keep a relevant guide in the evidence bundle when retrieval found one.
  // Product-scoped searches otherwise crowd all guide passages out of the top six.
  const guide = ranked.find(r => KNOWLEDGE.some(k => k.id === r.hit.doc.ref && k.kind === "guide"));
  const ordered = guide ? [guide, ...ranked.filter(r => r !== guide)] : ranked;
  for (const { hit, score, queries } of ordered) {
    if ((count.get(hit.doc.ref) ?? 0) >= 2) continue;
    count.set(hit.doc.ref, (count.get(hit.doc.ref) ?? 0) + 1);
    const k = KNOWLEDGE.find(k => k.id === hit.doc.ref);
    sources.push({ n: sources.length + 1, id: hit.doc.id, title: hit.doc.title, kind: k?.kind ?? "product", url: k ? `/guides/${k.id}` : `/p/${hit.doc.ref}`, snippet: hit.doc.text.slice(0, 240), text: hit.doc.text, queries: queries.size, score: Math.round(score * 10000) / 10000 });
    if (sources.length === 6) break;
  }
  const memory = input.gear.map(g => `${getProduct(g.productId)?.shortName}: owner-reported ${g.condition}; ${g.logs.filter(l => l.kind === "use").length} logged uses`);
  return { sources, trace: { queries, stages: ["Decompose activity + question + conditions", "BM25 + character n-grams + expansion", "Product-scoped evidence retrieval", "Cross-query reciprocal rank fusion", "Keep a relevant guide and limit duplicate source passages", "Recheck structured requirements"], sufficient: sources.length > 0, memory } };
}
