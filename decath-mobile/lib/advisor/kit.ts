/**
 * Activity kit: what the shopper already owns, what they need, and what new products they've chosen.
 * Owned and skipped items never appear in suggestions or totals; nothing is assumed needed by default.
 * Product budget (per item, from the brief) and kit budget (total of new purchases) are separate.
 */
import { getProduct, inr, products } from "@/lib/products";
import type { CartItem, Product } from "@/lib/types";
import { evaluateBrief, newBrief, type Brief, type Eval } from "./engine";
import { PROFILES, criterion, profileByCategory, type KitItemDef } from "./profiles";

export type ItemState = "own" | "need" | "unsure" | "skip" | null;
export type KitItem = {
  state: ItemState;
  /** chosen product id */
  pick: string | null;
  size: string | null;
  /** for "Not sure": the shopper chose to include it */
  include: boolean;
  /** optional details for owned items ("6 mm, a few years old") */
  ownNote?: string;
  /** the pick came from the main search (carried over, not re-suggested) */
  carried?: boolean;
};
export type Kit = { items: Record<string, KitItem>; budget: number | null };

export const kitDefs = (brief: Brief): KitItemDef[] => PROFILES[brief.profile].kit ?? [];
export const coreDef = (brief: Brief) => kitDefs(brief).find((d) => d.category === PROFILES[brief.profile].category);

export function newKit(brief: Brief, carriedPick: string | null): Kit {
  const items: Record<string, KitItem> = {};
  for (const d of kitDefs(brief)) items[d.id] = { state: null, pick: null, size: null, include: false };
  const core = coreDef(brief);
  if (core && carriedPick) items[core.id] = { ...items[core.id], pick: carriedPick, carried: true };
  return { items, budget: null };
}

/** The brief carried to another category: level and practice where that category understands them. */
function briefFor(brief: Brief, category: string): Brief | null {
  const prof = profileByCategory(category);
  if (!prof) return null;
  if (prof.id === brief.profile) return brief;
  const b = newBrief(prof.id);
  for (const k of ["level", "practice"]) if (k in brief.values && criterion(prof, k)) { b.values[k] = brief.values[k]; b.sources[k] = "stated"; }
  return b;
}

/** Suitable catalogue options for a kit item, ranked by the same engine (the item's own must-haves apply). */
export function kitOptions(brief: Brief, def: KitItemDef): Eval[] {
  if (!def.category) return [];
  const b = briefFor(brief, def.category);
  if (!b) return products.filter((p) => p.category === def.category && p.inStock).map((p) => ({ p, eligible: true, blockers: [], checks: [], prefScore: 0, budget: null }));
  return evaluateBrief(b, []).eligible;
}

/** "Why included?": the basis for the item plus the ranking facts behind the suggested product. */
export function whyIncluded(brief: Brief, def: KitItemDef, p: Product | null): string[] {
  const out = [def.basis];
  if (!p || !def.category) return out;
  const e = kitOptions(brief, def).find((x) => x.p.id === p.id);
  for (const c of e?.checks ?? []) if (c.status === "match") out.push(`Matches your ${c.label.toLowerCase()} (${c.label}: ${c.listed})`);
  if (e && e.checks.length && !e.checks.some((c) => c.status === "match")) out.push("No listed facts match your brief more closely than the other options; it's ranked by the same rules.");
  return out;
}

export type KitLine = { def: KitItemDef; item: KitItem; product: Product | null; inCart: boolean; needsSize: boolean };
export type KitSummary = {
  lines: KitLine[];
  covered: KitLine[];
  toChoose: KitLine[];
  selected: KitLine[];
  optional: KitLine[];
  skipped: KitLine[];
  total: number;
  remaining: number | null;
  over: number;
  undecided: number;
  allOwned: boolean;
  readyToAdd: KitLine[];
  missingSizes: KitLine[];
};

const buying = (i: KitItem) => i.state === "need" || (i.state === "unsure" && i.include);

export function summarise(brief: Brief, kit: Kit, cart: CartItem[]): KitSummary {
  const lines: KitLine[] = kitDefs(brief).map((def) => {
    const item = kit.items[def.id] ?? { state: null, pick: null, size: null, include: false };
    const product = item.pick ? getProduct(item.pick) ?? null : null;
    const needsSize = Boolean(product && product.sizes.length > 1);
    const inCart = Boolean(product && cart.some((c) => c.id === product.id && (!needsSize || !item.size || c.size === item.size)));
    return { def, item, product, inCart, needsSize };
  });
  const selected = lines.filter((l) => buying(l.item) && l.product);
  const total = selected.reduce((t, l) => t + l.product!.price, 0);
  const remaining = kit.budget === null ? null : kit.budget - total;
  const decided = lines.filter((l) => l.item.state);
  return {
    lines,
    covered: lines.filter((l) => l.item.state === "own"),
    toChoose: lines.filter((l) => buying(l.item) && !l.product),
    selected,
    optional: lines.filter((l) => l.item.state === null || (l.item.state === "unsure" && !l.item.include)),
    skipped: lines.filter((l) => l.item.state === "skip"),
    total,
    remaining,
    over: remaining !== null && remaining < 0 ? -remaining : 0,
    undecided: lines.length - decided.length,
    allOwned: decided.length > 0 && lines.every((l) => l.item.state === "own" || l.item.state === "skip") && lines.some((l) => l.item.state === "own"),
    readyToAdd: selected.filter((l) => !l.inCart && (!l.needsSize || l.item.size)),
    missingSizes: selected.filter((l) => l.needsSize && !l.item.size && !l.inCart),
  };
}

/** Cheaper eligible options for the selected items, best saving first (for an over-budget kit). */
export function cheaperSwaps(brief: Brief, sum: KitSummary): { line: KitLine; to: Product; saves: number }[] {
  const out: { line: KitLine; to: Product; saves: number }[] = [];
  for (const l of sum.selected) {
    const cheaper = kitOptions(brief, l.def).filter((e) => e.p.price < l.product!.price).sort((a, b) => a.p.price - b.p.price);
    if (cheaper[0]) out.push({ line: l, to: cheaper[0].p, saves: l.product!.price - cheaper[0].p.price });
  }
  return out.sort((a, b) => b.saves - a.saves);
}

const STATE_TEXT: Record<Exclude<ItemState, null>, string> = { own: "already owned", need: "needed", unsure: "not sure", skip: "skipped" };

/** One-line summary of a kit change, for the change banner. */
export function kitChangeText(brief: Brief, before: Kit, after: Kit): string[] {
  const out: string[] = [];
  for (const d of kitDefs(brief)) {
    const a = before.items[d.id], b = after.items[d.id];
    if (!a || !b) continue;
    if (a.state !== b.state) out.push(`${d.label}: ${b.state ? STATE_TEXT[b.state] : "undecided"}${b.state === "own" ? " (removed from purchases and totals)" : b.state === "skip" ? " (excluded)" : ""}`);
    if (a.pick !== b.pick) out.push(b.pick ? `${d.label}: ${getProduct(b.pick)?.shortName} selected` : `${d.label}: selection removed`);
    if (a.size !== b.size && b.size) out.push(`${d.label}: size ${b.size}`);
    if (a.include !== b.include && b.state === "unsure") out.push(`${d.label}: ${b.include ? "included" : "left out"}`);
  }
  if (before.budget !== after.budget) out.push(after.budget === null ? "Kit budget removed" : `Kit budget: ${inr(after.budget)}`);
  return out;
}
