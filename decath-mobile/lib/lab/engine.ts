import { createHash } from "node:crypto";
import { evaluateBrief, evaluateProduct, type Brief } from "../advisor/engine";
import { PROFILES } from "../advisor/profiles";
import { GOALS } from "../plan";
import { getProduct, products, toLite, inr } from "../products";
import type { Product } from "../types";
import { PROFILE } from "./input";
import { retrieveLab } from "./retrieval";
import type { Contract, Experiment, LabInput, LabProduct, LabResult, ScenarioLine, TeamLine } from "./types";

export const labProduct = (p: Product): LabProduct => ({ ...toLite(p), sizes: p.sizes, inStock: p.inStock, weightKg: p.weightKg });
const fingerprint = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex").slice(0, 12);
const spec = (p: Product, pattern: RegExp) => p.specifications.find(s => pattern.test(s.name));
export function labBrief(input: LabInput): Brief {
  return { profile: PROFILE[input.goal], budget: input.budget, values: { level: input.level, ...input.answers }, must: Object.fromEntries(Object.keys(input.answers).map(k => [k, true])), priority: input.priority, sources: {} };
}

function nextExperiment(input: LabInput, brief: Brief): Experiment | null {
  const pool = evaluateBrief(brief, []).eligible.map(e => e.p);
  if (pool.length < 2) return null;
  const candidates: Experiment[] = [];
  for (const c of PROFILES[brief.profile].criteria) {
    if (input.answers[c.id] || c.id === "level" || !c.canBeMust || !c.classify) continue;
    const known = pool.filter(p => c.classify!(p) !== null);
    const unknown = pool.length - known.length;
    const options = c.options.map(o => ({ id: o.id, label: o.label, count: known.filter(p => c.classify!(p)!.includes(o.id)).length }));
    const useful = options.filter(o => o.count > 0 && o.count < pool.length);
    if (!useful.length) continue;
    const expected = useful.reduce((n, o) => n + o.count, 0) / useful.length;
    candidates.push({ id: c.id, label: c.question ?? `What do you need for ${c.label.toLowerCase()}?`, why: `This separates the ${pool.length} current matches using the listed ${c.label.toLowerCase()} field. Counts are product counts, not confidence percentages.`, options, before: pool.length, unknown, expectedReduction: pool.length - expected });
  }
  return candidates.sort((a, b) => b.expectedReduction - a.expectedReduction)[0] ?? null;
}

function scenario(input: LabInput, stage: LabInput["stage"]): ScenarioLine[] {
  const definitions = GOALS[input.goal].needs;
  const needs = definitions.filter(n => n.essential || (stage === "progress" ? n.week <= 3 : stage === "challenge"));
  let remaining = input.budget;
  const brief = labBrief(input);
  if (input.goal === "running" && !input.answers.distance) { brief.values.distance = stage === "challenge" ? "full" : stage === "progress" ? "half" : "short"; brief.must.distance = true; }
  return needs.map(n => {
    const owned = input.gear.find(g => {
      const p = getProduct(g.productId);
      return g.condition === "good" && p?.category === n.category && (n.category !== PROFILES[PROFILE[input.goal]].category || evaluateProduct({ ...brief, budget: null }, p).eligible);
    });
    if (owned) return { category: n.category, label: n.label, product: labProduct(getProduct(owned.productId)!), owned: true, reason: "You marked this item usable; no new purchase counted." };
    let options = products.filter(p => p.category === n.category && p.inStock);
    if (n.category === PROFILES[PROFILE[input.goal]].category) {
      options = options.filter(p => evaluateProduct(brief, p).eligible);
    }
    options.sort((a, b) => a.price - b.price || b.rating - a.rating);
    const p = options.find(p => p.price <= remaining);
    if (!p) return { category: n.category, label: n.label, product: null, owned: false, reason: options.length ? `No eligible item fits the remaining ${inr(remaining)}. Lowest eligible price is ${inr(options[0].price)}.` : "No in-stock catalogue item confirms these requirements." };
    remaining -= p.price;
    return { category: n.category, label: n.label, product: labProduct(p), owned: false, reason: n.why };
  });
}

/** Buy the cheapest eligible essentials first, with explicit uncovered needs; never exceed a member budget.
 * Badminton shuttles may be shared. Personal shoes and clothing never are.
 */
export function teamPlan(input: LabInput): LabResult["team"] {
  const needs = GOALS[input.goal].needs.filter(n => n.essential);
  const remaining = new Map(input.members.map(m => [m.id, m.budget]));
  const lines: TeamLine[] = [];
  let savedBySharing = 0;
  for (const need of needs) {
    const shareable = input.goal === "badminton" && need.category === "Shuttlecocks";
    const options = products.filter(p => p.category === need.category && p.inStock && (p.category !== PROFILES[PROFILE[input.goal]].category || evaluateProduct({ ...labBrief(input), budget: null }, p).eligible)).sort((a, b) => a.price - b.price || b.rating - a.rating);
    const required = shareable ? [input.members[0]] : input.members;
    for (const member of required) {
      const allOwned = shareable ? input.members.flatMap(m => m.ownedIds) : [...member.ownedIds, ...(member.id === "me" ? input.gear.filter(g => g.condition === "good").map(g => g.productId) : [])];
      const own = allOwned.map(getProduct).find(p => p?.category === need.category && (p.category !== PROFILES[PROFILE[input.goal]].category || evaluateProduct({ ...labBrief(input), budget: null }, p).eligible));
      if (own) { lines.push({ memberId: member.id, category: need.category, product: labProduct(own), owned: true, shared: shareable, reason: "Existing equipment, reported by the team." }); continue; }
      const payer = shareable ? [...input.members].sort((a, b) => remaining.get(b.id)! - remaining.get(a.id)!)[0] : member;
      const p = options.find(p => p.price <= remaining.get(payer.id)!);
      if (p) remaining.set(payer.id, remaining.get(payer.id)! - p.price);
      if (p && shareable) savedBySharing += p.price * (input.members.length - 1);
      lines.push({ memberId: payer.id, category: need.category, product: p ? labProduct(p) : null, owned: false, shared: shareable, reason: p ? shareable ? "One shared set, charged once to the member with the most available budget." : "Lowest-price in-stock option that fits this member’s remaining budget; confirm personal fit." : "Not covered within individual budgets. No budget was exceeded." });
    }
  }
  return { lines, totals: input.members.map(m => ({ memberId: m.id, spent: m.budget - remaining.get(m.id)!, remaining: remaining.get(m.id)! })), uncovered: lines.filter(l => !l.product).length, savedBySharing };
}

export function analyzeLab(input: LabInput): LabResult {
  const brief = labBrief(input);
  const result = evaluateBrief(brief, []);
  const retrieved = retrieveLab(input, result.eligible.map(e => e.p.id));
  const evidenceScores = new Map<string, number>();
  for (const s of retrieved.sources) if (s.kind === "product") { const id = s.url.split("/").pop()!; evidenceScores.set(id, (evidenceScores.get(id) ?? 0) + s.score); }
  const ranked = input.priority === "match" ? [...result.ranked].sort((a, b) => Number(b.eligible) - Number(a.eligible) || b.prefScore - a.prefScore || (evidenceScores.get(b.p.id) ?? 0) - (evidenceScores.get(a.p.id) ?? 0) || a.p.price - b.p.price) : result.ranked;
  const candidates: Contract[] = ranked.slice(0, 6).map(e => {
    const checks = [...(e.budget ? [e.budget] : []), ...e.checks];
    checks.push({ id: "stock", label: "Availability", status: e.p.inStock ? "match" : "mismatch", must: true, wanted: "In stock", listed: e.p.inStock ? "In stock" : "Unavailable", evidence: { source: "Stock", field: "In stock", value: String(e.p.inStock) } });
    return { product: labProduct(e.p), eligible: e.eligible, checks, fingerprint: fingerprint({ id: e.p.id, price: e.p.price, inStock: e.p.inStock, specifications: e.p.specifications, benefits: e.p.benefits, sizes: e.p.sizes, material: e.p.materialAndCare, brief }), unknowns: checks.filter(c => c.status === "unknown").map(c => c.label) };
  });
  const ids = candidates.filter(c => c.eligible).map(c => c.product.id).slice(0, 3);
  const current = scenario(input, "start");
  const next = scenario(input, input.stage);
  const cost = (ls: ScenarioLine[]) => ls.reduce((s, l) => s + (!l.owned && l.product ? l.product.price : 0), 0);
  const first = ids.length ? getProduct(ids[0])! : null;
  const rehearsal: LabResult["rehearsal"] = [];
  if (input.rain) {
    const fact = first && spec(first, /waterproof/i);
    const confirmed = fact && /waterproof/i.test(fact.value) && !/no |not |repellent/i.test(fact.value);
    rehearsal.push({ title: "Rain protection", status: confirmed ? "ready" : fact ? "check" : "unknown", detail: fact ? `${first!.shortName}: ${fact.name} — ${fact.value}. A rain cover or water-repellent finish does not confirm a waterproof system.` : "The selected product has no confirmed waterproof field. Check protection separately.", sourceIds: first ? [`/p/${first.id}`] : [] });
  }
  if (input.longSession) rehearsal.push({ title: "Long-session preparation", status: "check", detail: input.goal === "running" ? "Review hydration access and comfort during a short trial before using new gear for a long session." : "Confirm carrying space, comfort and access to essentials for the longer session. Duration alone cannot establish personal suitability.", sourceIds: retrieved.sources.filter(s => s.kind === "guide").slice(0, 2).map(s => s.url) });
  if (input.outdoor) rehearsal.push({ title: "Outdoor setting", status: "check", detail: input.goal === "badminton" ? "Outdoor wind changes shuttle behaviour. Check the shuttle guide and the place-of-practice field." : "Terrain and weather are your selected assumptions, not live forecasts. Review the relevant product specifications.", sourceIds: retrieved.sources.filter(s => s.kind === "guide").slice(0, 2).map(s => s.url) });
  if (!rehearsal.length) rehearsal.push({ title: "Everyday conditions", status: "unknown", detail: "No extra conditions selected. This does not certify that the kit is suitable for every setting.", sourceIds: [] });
  const lifecycle = input.gear.map(g => {
    const p = getProduct(g.productId)!;
    const care = p.materialAndCare.map(c => `${c.name}: ${c.value}`).join(" ");
    return { gearId: g.id, name: p.shortName, minutes: g.logs.filter(l => l.kind === "use").reduce((s, l) => s + l.minutes, 0), uses: g.logs.filter(l => l.kind === "use").length,
      advice: g.condition === "repair" ? "You marked this item as needing repair. It is excluded from reuse; inspect it before use. No remaining-life estimate is inferred." : g.condition === "worn" ? "You reported wear. Inspect the item and consult its care guidance before deciding whether it is usable." : care ? care.slice(0, 700) : "No specific care instructions are listed for this item. Usage logs do not prove condition or remaining life.",
      sources: [{ n: 1, id: p.id, title: `${p.shortName} · material and care`, kind: "product" as const, url: `/p/${p.id}`, snippet: care || "Care information not specified." }] };
  });
  const advocate = GOALS[input.goal].needs.map(n => {
    const own = input.gear.find(g => getProduct(g.productId)?.category === n.category);
    const p = own ? getProduct(own.productId)! : null;
    const matches = p && (n.category !== PROFILES[PROFILE[input.goal]].category || evaluateProduct({ ...brief, budget: null }, p).eligible);
    if (own && p && own.condition === "good" && !matches) return { category: n.category, action: "inspect" as const, detail: "Your owned item does not confirm the current explicit requirements. Check it before treating it as suitable; buying a replacement is not assumed.", product: labProduct(p) };
    if (own && p) return { category: n.category, action: own.condition === "good" ? "reuse" as const : own.condition === "repair" ? "maintain" as const : "inspect" as const, detail: own.condition === "good" ? "You marked an owned item usable. Reuse it if it meets your actual activity needs; no new purchase is counted." : "Inspect or repair your existing item before considering a replacement. No repair service or price is assumed.", product: labProduct(p) };
    return { category: n.category, action: n.essential ? "consider" as const : "defer" as const, detail: n.essential ? "No owned item recorded. Check whether you can borrow or rent before buying; availability has not been verified." : "Optional for this activity. Defer until a real need appears.", product: null };
  });
  const answer = first ? `${first.shortName} is an eligible catalogue match at ${inr(first.price)}. ${candidates[0]?.unknowns.length ? `Still unknown: ${candidates[0].unknowns.join(", ")}.` : "The evidence contract lists the checks behind this result."} ${retrieved.sources.length ? `Retrieved ${retrieved.sources.length} passages across ${retrieved.trace.queries.length} targeted searches; open the sources to inspect the evidence.` : "No supporting passages were retrieved; no additional claims were inferred."}` : "No product confirms all current requirements within this budget. Change an explicit requirement or budget; the Lab will not relax it silently.";
  return { revision: fingerprint(input), brief, candidates, sources: retrieved.sources, retrieval: retrieved.trace, answer, experiment: nextExperiment(input, brief), future: { current, next, currentCost: cost(current), nextCost: cost(next), delta: cost(next) - cost(current), assumptions: ["Planning scenarios, not performance predictions.", `You selected a ${input.weeks}-week horizon; time does not prove readiness.`, "Only user-reported usable owned gear offsets purchases.", "Missing items remain visible when a budget or catalogue cannot cover them.", ...(input.goal === "running" && !input.answers.distance ? ["Default scenario assumptions: starting = up to 10K; progression = half marathon; challenge = full marathon. Override distance in Experiments."] : [])] }, rehearsal, lifecycle, team: teamPlan(input), advocate };
}
