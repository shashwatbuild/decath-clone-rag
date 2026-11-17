/**
 * Training plan: turns a goal, a start-in-weeks window and a budget into a week-by-week gear timeline.
 * Deterministic and catalogue-only: every item is a real in-stock product; nothing is invented.
 */
import { products } from "./products";
import type { Product } from "./types";

export type Goal = "yoga" | "running" | "trekking";

type Need = { id: string; category: string; label: string; week: number; essential: boolean; why: string };

export const GOALS: Record<Goal, { label: string; blurb: string; needs: Need[] }> = {
  yoga: {
    label: "Yoga",
    blurb: "Start with clothing you can move in, then a mat for home practice.",
    needs: [
      { id: "pants", category: "Yoga Pants", label: "Yoga pants", week: 1, essential: true, why: "Clothing you can stretch in. Start here." },
      { id: "mat", category: "Yoga Mats", label: "Yoga mat", week: 2, essential: true, why: "For home practice. Skip it if your studio lends mats." },
    ],
  },
  running: {
    label: "Running",
    blurb: "Shoes first, then a breathable top once your runs get longer.",
    needs: [
      { id: "shoes", category: "Running Shoes", label: "Running shoes", week: 1, essential: true, why: "The one purchase that matters most. Wear them in for a week before long runs." },
      { id: "top", category: "T-Shirts", label: "Running top", week: 3, essential: false, why: "Breathable layer for longer runs. Your current top may already do." },
    ],
  },
  trekking: {
    label: "Trekking",
    blurb: "A backpack for day hikes, then a quick-dry top for the trail.",
    needs: [
      { id: "pack", category: "Backpacks", label: "Day backpack", week: 2, essential: true, why: "Carries water and layers on day hikes." },
      { id: "top", category: "T-Shirts", label: "Quick-dry top", week: 4, essential: false, why: "Layers well on the trail. Optional for short walks." },
    ],
  },
};

export type PlanInput = { goal: Goal; weeks: number; budget: number; owned: string[] };
export type PlanLine = { need: Need; product: Product | null; owned: boolean; week: number; share: number };
export type PlanResult = {
  lines: PlanLine[];
  weeks: { week: number; lines: PlanLine[]; cost: number }[];
  total: number;
  budget: number;
  over: number;
  /** items with no in-stock product in the catalogue */
  unavailable: Need[];
};

/** Best-rated in-stock product that fits the item's share of the budget; the cheapest if none fits. */
function pickProduct(category: string, share: number): Product | null {
  const options = products.filter((p) => p.category === category && p.inStock);
  if (!options.length) return null;
  const fits = options.filter((p) => p.price <= share).sort((a, b) => b.rating - a.rating || a.price - b.price);
  return fits[0] ?? options.sort((a, b) => a.price - b.price)[0];
}

export function buildPlan({ goal, weeks, budget, owned }: PlanInput): PlanResult {
  const needs = GOALS[goal].needs;
  const buying = needs.filter((n) => !owned.includes(n.id));
  // Each item to buy gets an equal share of the budget; owned items cost nothing.
  const share = buying.length ? budget / buying.length : budget;
  const lines: PlanLine[] = needs.map((need) => {
    const isOwned = owned.includes(need.id);
    const product = isOwned ? null : pickProduct(need.category, share);
    // Items that fall after the window go into the last week, so nothing is dropped silently.
    return { need, product, owned: isOwned, week: Math.min(Math.max(need.week, 1), Math.max(weeks, 1)), share };
  });
  const toBuy = lines.filter((l) => !l.owned && l.product);
  const total = toBuy.reduce((t, l) => t + l.product!.price, 0);
  const weekList = Array.from({ length: Math.max(weeks, 1) }, (_, i) => i + 1).map((week) => {
    const wl = lines.filter((l) => l.week === week);
    return { week, lines: wl, cost: wl.filter((l) => !l.owned).reduce((t, l) => t + (l.product?.price ?? 0), 0) };
  });
  return {
    lines,
    weeks: weekList,
    total,
    budget,
    over: Math.max(0, total - budget),
    unavailable: lines.filter((l) => !l.owned && !l.product).map((l) => l.need),
  };
}

/**
 * Reads a plan request out of a chat message, e.g. "10K in 8 weeks, ₹5,000 budget".
 * Needs a goal AND a time window, so ordinary shopping questions are never hijacked.
 */
export function parsePlanRequest(msg: string): { goal: Goal; weeks: number; budget: number | null } | null {
  const t = msg.toLowerCase();
  if (!/\b(plan|training|train|prepar\w*|get ready|ready for)\b/.test(t)) return null;
  const goal: Goal | null = /\byoga\b/.test(t) ? "yoga"
    : /\b(trek\w*|hik\w*)\b/.test(t) ? "trekking"
    : /\b(run\w*|jog\w*|marathon|5k|10k|half)\b/.test(t) ? "running" : null;
  const wk = t.match(/(\d+)\s*(?:weeks?|wks?)\b/);
  const mo = t.match(/(\d+)\s*months?\b/);
  const weeks = wk ? Number(wk[1]) : mo ? Number(mo[1]) * 4 : null;
  if (!goal || weeks === null || weeks < 1) return null;
  const b = t.match(/(?:₹|rs\.?\s*|inr\s*|budget(?: of)?\s*|under\s*)(\d[\d,]*)\s*(k\b)?/);
  const n = b ? Number(b[1].replace(/,/g, "")) * (b[2] ? 1000 : 1) : null;
  return { goal, weeks: Math.min(12, weeks), budget: n && n >= 500 ? n : null };
}
