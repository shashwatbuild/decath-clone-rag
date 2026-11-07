/**
 * The shopping session: one source of truth for the brief, the compared products, pending questions
 * and Undo. Chat messages, brief edits and "What changes if…?" controls all go through `commit`.
 * Pure functions; the chat page keeps the Session in React state.
 */
import { inr } from "@/lib/products";
import { RE, detectCategories, namedProducts, parsePrice } from "@/lib/rag/assistant";
import { tokenize } from "@/lib/rag/index";
import { applyPatch, evaluateBrief, newBrief, questionsFor, verdictKey, type Brief, type BriefPatch, type Source } from "./engine";
import { briefDiff, changeEffect, ranksVerb } from "./explain";
import { products } from "@/lib/products";
import type { Product } from "@/lib/types";
import { PROFILES, asList, criterion, optionLabel, profileByCategory, type ProfileId, type Val } from "./profiles";
import { kitChangeText, kitDefs, newKit, type Kit, type KitItem } from "./kit";

export type Snapshot = { brief: Brief; selected: string[]; kit: Kit | null };
export type Change = { lines: string[]; effect: string; undone?: boolean; n: number };
/** Which tab of the recommendation area is showing (UI state, not part of Undo) */
export type View = "pick" | "compare" | "adjust" | "kit";
export type Session = {
  brief: Brief;
  selected: string[];
  /** questions still to ask; [0] is the one on screen */
  queue: string[];
  ready: boolean;
  /** how many products to compare when the panel first opens */
  count: number;
  /** index of the chat message that hosts the live panel */
  anchor: number;
  undo: Snapshot[];
  change: Change | null;
  /** follow-up questions asked so far (after the first, cards question) */
  asked: number;
  /** the shopper chose "Help me choose" for the pant type */
  helping: boolean;
  /** questions the shopper skipped (never asked again) */
  skipped: string[];
  /** product the shopper picked from the recommendation (carried into the kit) */
  chosen: string | null;
  /** activity kit; null until "Build my activity kit" */
  kit: Kit | null;
  view?: View;
};
export type SavedPrefs = Partial<Record<ProfileId, Pick<Brief, "values" | "must" | "priority">>>;

/** Model words that name one product ("capri", "trackpants", "dhoti"); the RAG tokenizer folds some of them into "pants". */
const MODEL = ["capri", "trackpants", "flared", "dhoti", "velour", "mt100", "mt500", "symbium", "kipride", "kipcore", "kipclimb", "triban", "riverside"];
const NAME_WORDS = new Map(
  MODEL.map((w) => [w, products.filter((p) => p.shortName.toLowerCase().split(/[^a-z0-9]+/).includes(w))] as const)
    .filter(([, ps]) => ps.length === 1)
    .map(([w, ps]) => [w, ps[0]]),
);
function namedIn(msg: string): Product[] {
  const words = msg.toLowerCase().split(/[^a-z0-9]+/);
  const out: Product[] = [];
  for (const w of words) { const p = NAME_WORDS.get(w) ?? NAME_WORDS.get(w.replace(/s$/, "")); if (p && !out.includes(p)) out.push(p); }
  for (const p of namedProducts(msg)) if (!out.includes(p)) out.push(p);
  return out;
}

const NEED = /\b(recommend|suggest|which|help|choose|need|want|looking|starting|start|new to|for (my|a|me)|good for|suitable|beginners?|best|compare|vs|versus|under|budget|cheap|light|lightest|thick|trek|trip|days?)\b/;

export type Start =
  | { kind: "ask-profile"; options: { id: ProfileId; label: string }[] }
  | { kind: "start"; brief: Brief; selected: string[] | null; count: number };

/** Should this message start the guided flow? Only for profiled categories, and only when the shopper describes a need. */
export function detectStart(msg: string, saved: SavedPrefs = {}): Start | null {
  const lower = msg.toLowerCase();
  if (RE.addCart.test(lower)) return null;
  const { range, rest } = parsePrice(msg);
  const cats = detectCategories(tokenize(rest));
  if (!cats.length || !cats.every((c) => profileByCategory(c))) return null;
  const named = namedIn(rest);
  const comparing = RE.compare.test(lower);
  if (named.length === 1 && !comparing) return null; // a question about one product: existing flow
  if (!range && !comparing && !NEED.test(lower)) return null; // plain "show yoga pants": existing listing
  if (cats.length > 1) return { kind: "ask-profile", options: cats.map((c) => profileByCategory(c)!).map((p) => ({ id: p.id, label: p.noun.charAt(0).toUpperCase() + p.noun.slice(1) })) };

  const profile = profileByCategory(cats[0])!;
  let brief = newBrief(profile.id);
  const s = saved[profile.id];
  if (s) {
    brief = { ...brief, values: { ...s.values }, must: { ...s.must }, priority: s.priority, sources: Object.fromEntries([...Object.keys(s.values), "priority"].map((k) => [k, "saved" as Source])) };
  }
  const patch = parseUpdate(msg, brief);
  if (patch) brief = applyPatch(brief, patch, "stated");
  if (range?.max) brief = applyPatch(brief, { budget: range.max }, "stated");
  const sameCat = named.filter((p) => p.category === profile.category);
  const count = /\b(3|three)\b/.test(lower) ? 3 : 2;
  return { kind: "start", brief, selected: comparing && sameCat.length >= 2 ? sameCat.slice(0, 3).map((p) => p.id) : null, count: sameCat.length >= 2 ? sameCat.length : count };
}

/** Brief changes stated in a chat message ("make it under 800", "full length please", "cheapest"). */
export function parseUpdate(msg: string, brief: Brief): BriefPatch | null {
  const lower = msg.toLowerCase();
  const profile = PROFILES[brief.profile];
  const patch: BriefPatch = {};
  const values: Record<string, Val> = {};
  const must: Record<string, boolean> = {};

  const { range } = parsePrice(msg);
  const raise = lower.replace(/,(?=\d{3})/g, "").match(/\bbudget\s*(?:to|of|is|=|:)?\s*(?:rs\.?|₹|inr)?\s*(\d+(?:\.\d+)?)\s*(k)?\b/);
  if (/\b(no budget|any budget|no (price )?limit|remove (the )?budget|budget doesn'?t matter)\b/.test(lower)) patch.budget = null;
  else if (range?.max) patch.budget = range.max;
  else if (raise) patch.budget = Math.round(Number(raise[1]) * (raise[2] ? 1000 : 1));

  for (const c of profile.criteria) {
    const hits = c.options.filter((o) => o.re?.test(lower));
    const hit = hits[0];
    if (hit) values[c.id] = c.multi ? hits.map((o) => o.id) : hit.id;
    else if (c.noneRe?.test(lower)) values[c.id] = null;
    if (c.canBeMust && (hit || c.id in brief.values)) {
      const first = hit ? hit.label.toLowerCase().split(" ")[0] : c.label.toLowerCase().split(" ")[0];
      const word = `(?:${[first, c.label.toLowerCase().split(" ")[0]].map((w) => w.replace(/[^a-z0-9]/g, "")).filter((w) => w && w !== "with").join("|")})`;
      const strict = "must|has to|have to|only|strictly|required|non-negotiable|essential";
      if (new RegExp(`\\b(${strict})\\b[^.,;]*\\b${word}|\\b${word}\\b[^.,;]*\\b(${strict})\\b`).test(lower)) must[c.id] = true;
      else if (new RegExp(`\\b${word}\\b[^.,;]*\\b(is fine|preferred|ideally|if possible|nice to have)\\b|\\b(other|any) lengths?\\b`).test(lower) && brief.must[c.id]) must[c.id] = false;
    }
  }
  // "under 1000" is a price, not capacity; "starting" is level, not trip duration
  if (values.capacity && range) delete values.capacity;
  // "high-waisted pants" names a waist, "pants" alone isn't a type
  if (/\bfit\b/.test(lower) && values.fit && Array.isArray(values.type) && values.type.join() === "relaxed") delete values.type;
  const prio = profile.priorities.find((p) => p.re?.test(lower));
  if (prio) patch.priority = prio.id;
  else if (/\b(best match|my preferences|preferences first)\b/.test(lower)) patch.priority = "match";

  if (Object.keys(values).length) patch.values = values;
  if (Object.keys(must).length) patch.must = must;
  return Object.keys(patch).length ? patch : null;
}

export function initialSelection(brief: Brief, count: number): string[] {
  const r = evaluateBrief(brief, []);
  return r.ranked.slice(0, Math.max(2, count)).map((e) => e.p.id).slice(0, r.eligible.length ? Math.max(2, count) : 0);
}

export function begin(brief: Brief, selected: string[] | null, count: number, anchor: number): Session {
  // comparing named products: no need to ask for a type first
  const queue = selected ? questionsFor(brief).filter((q) => !criterion(PROFILES[brief.profile], q)?.cards) : questionsFor(brief);
  return { brief, selected: selected ?? [], queue, ready: false, count, anchor, undo: [], change: null, asked: 0, helping: false, skipped: [], chosen: null, kit: null };
}

/** Finish the questions: pick the comparison and show the panel at `anchor`. */
export function finish(s: Session, anchor: number): Session {
  return { ...s, queue: [], ready: true, anchor, selected: s.selected.length ? s.selected : initialSelection(s.brief, s.count) };
}

/** Apply a change from any surface (chat, brief editor, what-if control) with Undo + explanation. */
export function commit(s: Session, patch: BriefPatch, source: Source = "edited", selected?: string[]): Session {
  const brief = applyPatch(s.brief, patch, source);
  let sel = selected ?? s.selected;
  if (brief.profile !== s.brief.profile) sel = initialSelection(brief, 2);
  const before = evaluateBrief(s.brief, s.selected);
  const after = evaluateBrief(brief, sel);
  const lines = briefDiff(s.brief, brief);
  if (!lines.length && sel.join() === s.selected.join()) return s;
  return {
    ...s,
    brief,
    selected: sel,
    undo: [...s.undo, snap(s)].slice(-20),
    change: { lines, effect: lines.length ? changeEffect(s.brief, before, brief, after, verdictKey) : selectionEffect(after), n: (s.change?.n ?? 0) + 1 },
  };
}

const snap = (s: Session): Snapshot => ({ brief: s.brief, selected: s.selected, kit: s.kit });

/** Open the activity kit, carrying the pants already chosen (or recommended) so they aren't suggested twice. */
export function openKit(s: Session): Session {
  if (s.kit) return s;
  const r = evaluateBrief(s.brief, s.selected);
  const top = r.verdict.kind === "pick" || r.verdict.kind === "only" ? r.verdict.top.p.id : null;
  return { ...s, kit: newKit(s.brief, s.chosen ?? top), view: "kit" };
}

/** Change kit items or the kit budget (one Undo step, with a summary). */
export function commitKit(s: Session, items: Record<string, Partial<KitItem>>, budget?: number | null): Session {
  if (!s.kit) return s;
  const kit: Kit = { budget: budget === undefined ? s.kit.budget : budget, items: { ...s.kit.items } };
  for (const [id, patch] of Object.entries(items)) {
    const cur = kit.items[id];
    if (!cur) continue;
    const next = { ...cur, ...patch };
    // owned / skipped items drop out of purchases
    if (patch.state === "own" || patch.state === "skip") next.include = false;
    kit.items[id] = next;
  }
  const lines = kitChangeText(s.brief, s.kit, kit);
  if (!lines.length) return s;
  return { ...s, kit, undo: [...s.undo, snap(s)].slice(-20), change: { lines, effect: kitEffect(s, kit), n: (s.change?.n ?? 0) + 1 } };
}

function kitEffect(s: Session, kit: Kit): string {
  const defs = kitDefs(s.brief);
  const buying = defs.filter((d) => { const i = kit.items[d.id]; return i && (i.state === "need" || (i.state === "unsure" && i.include)); });
  const owned = defs.filter((d) => kit.items[d.id]?.state === "own");
  if (owned.length && owned.length + defs.filter((d) => kit.items[d.id]?.state === "skip").length === defs.length) return "You have the items selected for this kit. No new purchases needed.";
  return `${kitChangeText(s.brief, s.kit!, kit).join(" · ")}. ${buying.length} to buy, ${owned.length} owned.`;
}

function selectionEffect(r: ReturnType<typeof evaluateBrief>): string {
  const v = r.verdict;
  return v.kind === "pick" || v.kind === "only" ? `Comparison updated. The ${v.top.p.shortName} ranks first.` : v.kind === "tie" ? "Comparison updated. No clear winner among these." : "Comparison updated.";
}

export function undo(s: Session): Session {
  const prev = s.undo[s.undo.length - 1];
  if (!prev) return s;
  const before = evaluateBrief(s.brief, s.selected), after = evaluateBrief(prev.brief, prev.selected);
  const topP = after.verdict.kind === "pick" || after.verdict.kind === "only" ? after.verdict.top.p : null;
  return {
    ...s,
    brief: prev.brief,
    selected: prev.selected,
    kit: prev.kit,
    undo: s.undo.slice(0, -1),
    change: {
      lines: [...briefDiff(s.brief, prev.brief), ...(s.kit && prev.kit ? kitChangeText(s.brief, s.kit, prev.kit) : s.kit && !prev.kit ? ["Kit closed"] : [])],
      effect: `Undone: your earlier ${prev.kit && s.kit && briefDiff(s.brief, prev.brief).length === 0 ? "kit" : "brief"} is back.${verdictKey(before) !== verdictKey(after) && topP ? ` The ${topP.shortName} ${ranksVerb(topP)} first again.` : ""}`,
      undone: true,
      n: (s.change?.n ?? 0) + 1,
    },
  };
}

/** The question on screen, as a chat message. Cards questions are drawn as visual cards by the chat page. */
export function questionMessage(s: Session, intro?: string): { text: string; suggestions: string[]; cards?: string } {
  const c = criterion(PROFILES[s.brief.profile], s.queue[0])!;
  if (c.cards) return { text: `${intro ? intro + "\n\n" : ""}**${c.question}** Pick one or more.`, suggestions: [], cards: c.id };
  const more = s.queue.length > 1;
  return {
    text: `${intro ? intro + "\n\n" : ""}**${c.question}**`,
    suggestions: [...c.options.map((o) => o.label), c.noneLabel, "Skip", ...(more ? ["Show results now"] : [])],
  };
}

export const HELP = "Help me choose";

/** Answer the question on screen from a chip / card tap or typed text. null = the message isn't an answer. */
export function answer(s: Session, msg: string): Session | null {
  const profile = PROFILES[s.brief.profile];
  const c = criterion(profile, s.queue[0]);
  if (!c) return null;
  const lower = msg.toLowerCase().trim();
  const next = (brief: Brief, helping = s.helping, skip = false): Session => {
    const asked = s.asked + (c.cards ? 0 : 1);
    const skipped = skip ? [...s.skipped, c.id] : s.skipped;
    const left = Math.max(0, (profile.maxQuestions ?? 3) - asked);
    const open = (q: string) => !criterion(profile, q)?.cards && !skipped.includes(q) && !(q in brief.values);
    // ask the next most useful questions; skipped ones stay skipped
    let queue = questionsFor({ ...brief, values: { ...brief.values, ...Object.fromEntries(skipped.map((k) => [k, brief.values[k] ?? null])) } }, left).filter(open);
    if (helping) queue = ["fit", "practice"].filter((q) => criterion(profile, q) && open(q)).concat(queue.filter((q) => q !== "fit" && q !== "practice"));
    return { ...s, brief, asked, helping, skipped, queue: queue.slice(0, left) };
  };
  if (lower === "show results now") return { ...s, queue: [] };
  if (lower === "skip") return next(s.brief, s.helping, true);
  if (c.cards && lower === HELP.toLowerCase()) return next(s.brief, true);
  // several card labels joined with " + "
  const parts = lower.split(/\s*\+\s*|\s*,\s*/).filter(Boolean);
  const byLabel = c.options.filter((o) => parts.includes(o.label.toLowerCase()));
  const opts = byLabel.length ? byLabel : c.options.filter((o) => o.re?.test(lower)).slice(0, c.multi ? undefined : 1);
  const none = lower === c.noneLabel.toLowerCase() || c.noneRe?.test(lower) || /^(not sure|no preference|any|either|don'?t mind)$/.test(lower);
  if (!opts.length && !none) return null;
  const value: Val = opts.length ? (c.multi ? opts.map((o) => o.id) : opts[0].id) : null;
  return next(applyPatch(s.brief, { values: { [c.id]: value } }, "answered"));
}

/** Cards for a cards question: each available type with a representative image and catalogue facts. */
export function cardsFor(brief: Brief, id: string) {
  const profile = PROFILES[brief.profile];
  const c = criterion(profile, id);
  if (!c?.classify) return [];
  const inCat = products.filter((p) => p.category === profile.category && p.inStock);
  return c.options
    .map((o) => {
      const ps = inCat.filter((p) => c.classify!(p)?.includes(o.id)).sort((a, b) => a.price - b.price);
      const inBudget = brief.budget === null ? ps : ps.filter((p) => p.price <= brief.budget!);
      return { id: o.id, label: o.label, hint: o.hint ?? "", image: (inBudget[0] ?? ps[0])?.images[0], count: ps.length, from: ps[0]?.price, inBudget: inBudget.length };
    })
    .filter((x) => x.count > 0);
}

/** After "Help me choose": how each type fits the fit and practice the shopper gave (catalogue facts only). */
export function helpSummary(brief: Brief): string {
  const profile = PROFILES[brief.profile];
  const type = criterion(profile, "type");
  if (!type?.classify) return "";
  const r = evaluateBrief(brief, []);
  const lines = type.options.map((o) => {
    const es = r.eligible.filter((e) => type.classify!(e.p)?.includes(o.id));
    if (!es.length) return `- **${o.label}**: none ${brief.budget !== null ? "within your budget" : "available"}`;
    const matched = es.filter((e) => e.checks.some((c) => (c.id === "fit" || c.id === "practice") && c.status === "match"));
    const facts = [...new Set(matched.flatMap((e) => e.checks.filter((c) => (c.id === "fit" || c.id === "practice") && c.status === "match").map((c) => `${c.label}: ${c.listed}`)))].slice(0, 2);
    return `- **${o.label}**: ${es.length} option${es.length > 1 ? "s" : ""}${matched.length ? `, ${matched.length} listed as a match (${facts.join("; ")})` : ", none listed as matching your answers"}`;
  });
  return `Here's how the pant types compare on what the catalogue lists. I've kept all types open; your answers rank them.\n\n${lines.join("\n")}`;
}

export function acknowledge(brief: Brief): string {
  const p = PROFILES[brief.profile];
  const bits: string[] = [];
  for (const c of p.criteria) {
    const v = brief.values[c.id];
    if (asList(v).length && brief.sources[c.id] !== "implied") bits.push(optionLabel(c, v).toLowerCase());
  }
  bits.push(p.noun);
  if (brief.budget !== null) bits.push(`up to ${inr(brief.budget)}`);
  const savedUsed = Object.values(brief.sources).includes("saved");
  return `Got it: **${bits.join(" · ")}**.${savedUsed ? " (Using preferences saved on this device.)" : ""}`;
}

/** Kit changes stated in chat: "I already have a mat", "skip the strap", "kit budget 2500". */
export function parseKit(msg: string, s: Session): { items: Record<string, Partial<KitItem>>; budget?: number | null } | null {
  if (!s.kit) return null;
  const lower = msg.toLowerCase();
  const words: Record<string, RegExp> = { mat: /\bmats?\b/, blocks: /\bblocks?\b/, strap: /\bstraps?\b/, pants: /\b(pants|leggings|clothing|clothes|bottoms)\b/ };
  const items: Record<string, Partial<KitItem>> = {};
  for (const d of kitDefs(s.brief)) {
    const re = words[d.id];
    if (!re || !re.test(lower)) continue;
    if (/\b(already (have|own|got)|i (have|own)|got (a|one))\b/.test(lower)) items[d.id] = { state: "own" };
    else if (/\b(skip|don'?t need|no need for|without|not needed)\b/.test(lower)) items[d.id] = { state: "skip" };
    else if (/\b(not sure|maybe)\b/.test(lower)) items[d.id] = { state: "unsure" };
    else if (/\b(need|want|add|include)\b/.test(lower)) items[d.id] = { state: "need" };
  }
  const b = lower.replace(/,(?=\d{3})/g, "").match(/\b(?:kit|total|overall) budget\s*(?:to|of|is|=|:)?\s*(?:rs\.?|₹|inr)?\s*(\d+)\s*(k)?\b/);
  const budget = /\b(no|remove( the)?) kit budget\b/.test(lower) ? null : b ? Number(b[1]) * (b[2] ? 1000 : 1) : undefined;
  return Object.keys(items).length || budget !== undefined ? { items, budget } : null;
}
