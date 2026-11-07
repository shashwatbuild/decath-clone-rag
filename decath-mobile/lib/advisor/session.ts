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
import { PROFILES, criterion, optionLabel, profileByCategory, type ProfileId } from "./profiles";

export type Snapshot = { brief: Brief; selected: string[] };
export type Change = { lines: string[]; effect: string; undone?: boolean; n: number };
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
  const values: Record<string, string | null> = {};
  const must: Record<string, boolean> = {};

  const { range } = parsePrice(msg);
  const raise = lower.replace(/,(?=\d{3})/g, "").match(/\bbudget\s*(?:to|of|is|=|:)?\s*(?:rs\.?|₹|inr)?\s*(\d+(?:\.\d+)?)\s*(k)?\b/);
  if (/\b(no budget|any budget|no (price )?limit|remove (the )?budget|budget doesn'?t matter)\b/.test(lower)) patch.budget = null;
  else if (range?.max) patch.budget = range.max;
  else if (raise) patch.budget = Math.round(Number(raise[1]) * (raise[2] ? 1000 : 1));

  for (const c of profile.criteria) {
    const hit = c.options.find((o) => o.re?.test(lower));
    if (hit) values[c.id] = hit.id;
    else if (c.noneRe?.test(lower)) values[c.id] = null;
    if (c.canBeMust && (hit || c.id in brief.values)) {
      const word = hit ? hit.label.toLowerCase().split(" ")[0] : c.label.toLowerCase();
      const strict = "must|has to|have to|only|strictly|required|non-negotiable|essential";
      if (new RegExp(`\\b(${strict})\\b[^.,;]*\\b${word}|\\b${word}\\b[^.,;]*\\b(${strict})\\b`).test(lower)) must[c.id] = true;
      else if (new RegExp(`\\b${word}\\b[^.,;]*\\b(is fine|preferred|ideally|if possible|nice to have)\\b|\\b(other|any) lengths?\\b`).test(lower) && brief.must[c.id]) must[c.id] = false;
    }
  }
  // "under 1000" is a price, not capacity; "starting" is level, not trip duration
  if (values.capacity && range) delete values.capacity;
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
  return { brief, selected: selected ?? [], queue: questionsFor(brief), ready: false, count, anchor, undo: [], change: null };
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
    undo: [...s.undo, { brief: s.brief, selected: s.selected }].slice(-20),
    change: { lines, effect: lines.length ? changeEffect(s.brief, before, brief, after, verdictKey) : selectionEffect(after), n: (s.change?.n ?? 0) + 1 },
  };
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
    undo: s.undo.slice(0, -1),
    change: {
      lines: briefDiff(s.brief, prev.brief),
      effect: `Undone: your earlier brief is back.${verdictKey(before) !== verdictKey(after) && topP ? ` The ${topP.shortName} ${ranksVerb(topP)} first again.` : ""}`,
      undone: true,
      n: (s.change?.n ?? 0) + 1,
    },
  };
}

/** The question on screen, as a chat message. */
export function questionMessage(s: Session, intro?: string) {
  const c = criterion(PROFILES[s.brief.profile], s.queue[0])!;
  return {
    text: `${intro ? intro + "\n\n" : ""}**${c.question}**`,
    suggestions: [...c.options.map((o) => o.label), c.noneLabel, "Skip", ...(s.queue.length > 1 ? ["Show results now"] : [])],
  };
}

/** Answer the question on screen from a chip tap or typed text. null = the message isn't an answer. */
export function answer(s: Session, msg: string): Session | null {
  const c = criterion(PROFILES[s.brief.profile], s.queue[0]);
  if (!c) return null;
  const lower = msg.toLowerCase().trim();
  if (lower === "show results now") return { ...s, queue: [] };
  if (lower === "skip") return { ...s, queue: s.queue.slice(1) };
  const opt = c.options.find((o) => o.label.toLowerCase() === lower) ?? c.options.find((o) => o.re?.test(lower));
  const none = lower === c.noneLabel.toLowerCase() || c.noneRe?.test(lower) || /^(not sure|no preference|any|either|don'?t mind)$/.test(lower);
  if (!opt && !none) return null;
  const brief = applyPatch(s.brief, { values: { [c.id]: opt ? opt.id : null } }, "answered");
  // later questions may no longer matter once this is answered
  const still = new Set(questionsFor(brief, 5));
  return { ...s, brief, queue: s.queue.slice(1).filter((q) => still.has(q)) };
}

export function acknowledge(brief: Brief): string {
  const p = PROFILES[brief.profile];
  const bits: string[] = [];
  for (const c of p.criteria) {
    const v = brief.values[c.id];
    if (v && brief.sources[c.id] !== "implied") bits.push(optionLabel(c, v).toLowerCase());
  }
  bits.push(p.noun);
  if (brief.budget !== null) bits.push(`up to ${inr(brief.budget)}`);
  const savedUsed = Object.values(brief.sources).includes("saved");
  return `Got it: **${bits.join(" · ")}**.${savedUsed ? " (Using preferences saved on this device.)" : ""}`;
}
