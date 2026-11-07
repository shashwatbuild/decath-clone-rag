/**
 * Recommendation engine: one pure function from (brief, selected products) to a result.
 *   1. must-haves decide eligibility (budget, in stock, criteria marked must-have)
 *   2. eligible products are ranked by the shopper's priority and preferences
 *   3. every ranking decision records the reason, so explanations are generated from it (explain.ts)
 * No scores are shown; ties are reported as ties instead of being broken by guesswork.
 */
import { getProduct, inr, products } from "@/lib/products";
import type { Product } from "@/lib/types";
import { PROFILES, asList, criterion, optionLabel, type Criterion, type Evidence, type Profile, type ProfileId, type Val } from "./profiles";

export type Source = "stated" | "answered" | "edited" | "saved" | "implied";
export type Brief = {
  profile: ProfileId;
  /** must-have maximum price; null = no limit */
  budget: number | null;
  /** criterion id -> option id (or ids, for multi-select); null = no preference / not sure; missing = not asked */
  values: Record<string, Val>;
  must: Record<string, boolean>;
  priority: string;
  sources: Record<string, Source>;
  /** size the shopper picked (from the cart or kit), shown in the brief */
  size?: string;
};

export type Status = "match" | "mismatch" | "unknown";
export type Check = {
  id: string;
  label: string;
  status: Status;
  must: boolean;
  /** what the shopper asked for ("Full length") */
  wanted: string;
  /** what the catalogue says ("Below the knee") or "Not specified" */
  listed: string;
  evidence: Evidence | null;
};
export type Eval = {
  p: Product;
  eligible: boolean;
  /** failed or unconfirmed must-haves */
  blockers: Check[];
  /** preference checks (criteria with a value) */
  checks: Check[];
  /** +1 per matched preference, -1 per mismatch, 0 when not specified */
  prefScore: number;
  budget: Check | null;
};
export type Reason =
  | { kind: "prefs"; won: Check[] }
  | { kind: "price"; diff: number }
  | { kind: "weight"; diff: number };
export type Conflict = { musts: Check["id"][]; text: string; fixes: Fix[] };
export type Fix = { label: string; patch: BriefPatch };
export type Verdict =
  | { kind: "pick"; top: Eval; alt: Eval; reason: Reason }
  | { kind: "tie"; group: Eval[] }
  | { kind: "only"; top: Eval }
  | { kind: "none"; conflict: Conflict };
export type Result = {
  profile: Profile;
  /** all category products, eligible ones first in rank order */
  ranked: Eval[];
  eligible: Eval[];
  /** the comparison columns, in the shopper's order */
  selected: Eval[];
  verdict: Verdict;
  /** eligible products not in the comparison, best first */
  alternatives: Eval[];
};
export type BriefPatch = Partial<Pick<Brief, "budget" | "priority" | "profile" | "size">> & {
  values?: Record<string, Val>;
  must?: Record<string, boolean>;
};

export const profileOf = (b: Brief) => PROFILES[b.profile];
export const NOT_SPECIFIED = "Not specified";

function check(c: Criterion, p: Product, value: Val, must: boolean): Check {
  const ids = c.classify?.(p) ?? null;
  const ev = c.fact?.(p) ?? null;
  const wanted = asList(value);
  return {
    id: c.id,
    label: c.label,
    // benefit-based criteria: a benefit that isn't listed is unknown, never a mismatch
    status: ids === null ? "unknown" : wanted.some((w) => ids.includes(w)) ? "match" : c.benefitBased ? "unknown" : "mismatch",
    must,
    wanted: optionLabel(c, value),
    listed: c.display?.(p) ?? ev?.value ?? NOT_SPECIFIED,
    evidence: ev,
  };
}

export function evaluateProduct(brief: Brief, p: Product): Eval {
  const profile = profileOf(brief);
  const blockers: Check[] = [];
  const checks: Check[] = [];
  let budget: Check | null = null;
  if (brief.budget !== null) {
    budget = {
      id: "budget",
      label: "Budget",
      status: p.price <= brief.budget ? "match" : "mismatch",
      must: true,
      wanted: `Up to ${inr(brief.budget)}`,
      listed: inr(p.price),
      evidence: { source: "Price", field: "Current price", value: inr(p.price) },
    };
    if (budget.status !== "match") blockers.push(budget);
  }
  if (!p.inStock)
    blockers.push({ id: "stock", label: "Availability", status: "mismatch", must: true, wanted: "In stock", listed: "Currently unavailable", evidence: { source: "Stock", field: "In stock", value: "No" } });
  let prefScore = 0;
  for (const c of profile.criteria) {
    const v = brief.values[c.id];
    if (!asList(v).length || c.informational || !c.classify) continue;
    const must = Boolean(brief.must[c.id] && c.canBeMust);
    const ch = check(c, p, v, must);
    checks.push(ch);
    if (must && ch.status !== "match") blockers.push(ch);
    prefScore += ch.status === "match" ? 1 : ch.status === "mismatch" ? -1 : 0;
  }
  return { p, eligible: blockers.length === 0, blockers, checks, prefScore, budget };
}

/** Negative when a ranks above b. 0 = no evidence-based difference (a tie). */
function decisive(mode: string, a: Eval, b: Eval): number {
  const byPrefs = b.prefScore - a.prefScore;
  if (mode === "price") return a.p.price - b.p.price || byPrefs;
  if (mode === "weight") {
    const wa = a.p.weightKg ?? Infinity, wb = b.p.weightKg ?? Infinity;
    return (wa === wb ? 0 : wa - wb) || byPrefs;
  }
  return byPrefs;
}

/** Display order inside a tie: lowest price first (stated as such in the UI), then more reviews. */
const tieOrder = (a: Eval, b: Eval) => a.p.price - b.p.price || b.p.reviewCount - a.p.reviewCount;

function rank(mode: string, evals: Eval[]) {
  return [...evals].sort((a, b) => decisive(mode, a, b) || tieOrder(a, b));
}

function reasonFor(mode: string, top: Eval, alt: Eval): Reason {
  if (mode === "price" && top.p.price !== alt.p.price) return { kind: "price", diff: alt.p.price - top.p.price };
  if (mode === "weight" && top.p.weightKg !== alt.p.weightKg && top.p.weightKg !== null)
    return { kind: "weight", diff: Math.round(((alt.p.weightKg ?? 0) - top.p.weightKg) * 1000) / 1000 };
  const won = top.checks.filter((c) => {
    const other = alt.checks.find((o) => o.id === c.id);
    const v = (s?: Status) => (s === "match" ? 1 : s === "mismatch" ? -1 : 0);
    return v(c.status) > v(other?.status);
  });
  return { kind: "prefs", won };
}

function describeMusts(brief: Brief): string {
  const profile = profileOf(brief);
  const parts: string[] = [];
  for (const c of profile.criteria)
    if (brief.must[c.id] && c.canBeMust && asList(brief.values[c.id]).length) parts.push(optionLabel(c, brief.values[c.id]).toLowerCase());
  // "flared yoga pants" already names the product: don't repeat the noun
  const named = parts.some((x) => /(pants|leggings|capris)$/.test(x));
  return `${parts.length ? parts.join(", ") + (named ? "" : " ") : ""}${named ? "" : profile.noun}${brief.budget !== null ? ` under ${inr(brief.budget)}` : ""}`;
}

function conflictFor(brief: Brief, all: Product[]): Conflict {
  const profile = profileOf(brief);
  const fixes: Fix[] = [];
  const musts: string[] = [];
  if (brief.budget !== null) {
    musts.push("budget");
    const fits = all.filter((p) => evaluateProduct({ ...brief, budget: null }, p).eligible).sort((a, b) => a.price - b.price);
    if (fits.length) fixes.push({ label: `Raise budget to ${inr(fits[0].price)}`, patch: { budget: fits[0].price } });
  }
  for (const c of profile.criteria) {
    if (!(brief.must[c.id] && c.canBeMust && asList(brief.values[c.id]).length)) continue;
    musts.push(c.id);
    const allow: Record<string, string> = { coverage: "Allow other lengths", length: "Allow other lengths", type: "Allow other pant types", fit: "Allow other fits", colour: "Allow other colours" };
    fixes.push({ label: allow[c.id] ?? `Make ${c.label.toLowerCase()} a preference`, patch: { must: { [c.id]: false } } });
  }
  return { musts, text: `Nothing currently matches ${describeMusts(brief)}.`, fixes };
}

export function evaluateBrief(brief: Brief, selectedIds: string[]): Result {
  const profile = profileOf(brief);
  const inCat = products.filter((p) => p.category === profile.category);
  const evals = inCat.map((p) => evaluateProduct(brief, p));
  const eligible = rank(brief.priority, evals.filter((e) => e.eligible));
  const ranked = [...eligible, ...evals.filter((e) => !e.eligible).sort((a, b) => a.blockers.length - b.blockers.length || a.p.price - b.p.price)];
  const selected = selectedIds
    .map((id) => getProduct(id))
    .filter((p): p is Product => Boolean(p))
    .map((p) => evals.find((e) => e.p.id === p.id) ?? evaluateProduct(brief, p));
  const alternatives = eligible.filter((e) => !selectedIds.includes(e.p.id));

  let verdict: Verdict;
  // The recommendation is made among the products being compared; if none of them is eligible, among the category.
  const pool = rank(brief.priority, selected.filter((e) => e.eligible));
  const from = pool.length ? pool : eligible.slice(0, 2);
  if (!eligible.length) verdict = { kind: "none", conflict: conflictFor(brief, inCat) };
  else if (from.length === 1) verdict = { kind: "only", top: from[0] };
  else if (decisive(brief.priority, from[0], from[1]) === 0) verdict = { kind: "tie", group: from.filter((e) => decisive(brief.priority, from[0], e) === 0) };
  else verdict = { kind: "pick", top: from[0], alt: from[1], reason: reasonFor(brief.priority, from[0], from[1]) };

  return { profile, ranked, eligible, selected, verdict, alternatives };
}

export function applyPatch(brief: Brief, patch: BriefPatch, source: Source = "edited"): Brief {
  const next: Brief = { ...brief, values: { ...brief.values }, must: { ...brief.must }, sources: { ...brief.sources } };
  if (patch.profile && patch.profile !== brief.profile) {
    // switching activity: keep what still applies (level, budget if it fits the new range), drop the rest
    const target = PROFILES[patch.profile];
    next.profile = patch.profile;
    next.values = Object.fromEntries(Object.entries(next.values).filter(([k]) => criterion(target, k)));
    next.must = Object.fromEntries(Object.entries(next.must).filter(([k]) => criterion(target, k)));
    if (!target.priorities.some((p) => p.id === next.priority)) next.priority = "match";
    next.sources.profile = source;
  }
  if ("budget" in patch && patch.budget !== undefined) { next.budget = patch.budget; next.sources.budget = source; }
  if (patch.size) next.size = patch.size;
  if (patch.priority) { next.priority = patch.priority; next.sources.priority = source; }
  const profile = profileOf(next);
  for (const [k, v] of Object.entries(patch.values ?? {})) {
    next.values[k] = v;
    next.sources[k] = source;
    const implied = typeof v === "string" ? criterion(profile, k)?.implies?.(v) : null;
    if (implied) for (const [ik, iv] of Object.entries(implied.values)) { next.values[ik] = iv; next.sources[ik] = "implied"; }
  }
  for (const [k, v] of Object.entries(patch.must ?? {})) next.must[k] = v;
  return next;
}

/** Top-of-result identity, for "did the recommendation change?" */
export function verdictKey(r: Result) {
  const v = r.verdict;
  return v.kind === "pick" || v.kind === "only" ? `${v.kind}:${v.top.p.id}` : v.kind === "tie" ? `tie:${v.group.map((e) => e.p.id).join(",")}` : "none";
}

/**
 * Questions worth asking: a "cards" question first (e.g. pant type) when not yet answered, then at most
 * `maxQuestions` more, each one not yet answered and able to separate the products still in play.
 */
export function questionsFor(brief: Brief, max?: number): string[] {
  const profile = profileOf(brief);
  max = max ?? profile.maxQuestions ?? 3;
  const inPlay = products.filter((p) => p.category === profile.category && evaluateProduct(brief, p).eligible);
  const out: string[] = profile.criteria.filter((c) => c.cards && !(c.id in brief.values)).map((c) => c.id);
  const first = out.length;
  for (const c of profile.criteria) {
    if (!c.question || c.cards || c.refine || c.id in brief.values) continue;
    const reads = (crit: Criterion) => new Set(inPlay.map((p) => JSON.stringify(crit.classify?.(p) ?? "?"))).size > 1;
    const matters = c.informational
      ? c.options.some((o) => { const imp = c.implies?.(o.id); return imp && Object.keys(imp.values).some((k) => { const ic = criterion(profile, k); return ic && reads(ic); }); })
      : reads(c);
    if (matters && inPlay.length > 1) out.push(c.id);
    if (out.length - first >= max) break;
  }
  return out;
}

export function newBrief(profile: ProfileId): Brief {
  return { profile, budget: null, values: {}, must: {}, priority: "match", sources: {} };
}
