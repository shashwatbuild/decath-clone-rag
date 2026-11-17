/**
 * Training plan: turns a goal, a start-in-weeks window and a budget into a week-by-week gear timeline.
 * Deterministic and catalogue-only: every item is a real in-stock product; nothing is invented.
 */
import { products } from "./products";
import type { Product } from "./types";

export type Goal = "badminton" | "running" | "yoga" | "trekking";

/** w = how big a share of the budget this item usually takes (a shoe costs more than a grip) */
type Need = { id: string; category: string; label: string; week: number; essential: boolean; why: string; w?: number };

export const GOALS: Record<Goal, { label: string; blurb: string; needs: Need[] }> = {
  badminton: {
    label: "Badminton",
    blurb: "Racket and court shoes first, then shuttles, grips and clothing.",
    needs: [
      { id: "racket", category: "Badminton Rackets", label: "Racket", week: 1, essential: true, w: 2, why: "Start here. A light, easy-to-handle racket is enough to learn." },
      { id: "shoes", category: "Badminton Shoes", label: "Court shoes", week: 1, essential: true, w: 3, why: "Grip and cushioning for quick side-to-side moves. Running shoes aren't built for it." },
      { id: "shuttles", category: "Shuttlecocks", label: "Shuttlecocks", week: 2, essential: true, w: 2, why: "They wear out fast. Plastic shuttles last longer; feather ones fly truer." },
      { id: "grip", category: "Badminton Accessories", label: "Grip", week: 3, essential: false, w: 0.5, why: "A fresh grip stops the racket slipping and costs very little." },
      { id: "apparel", category: "Badminton Apparel", label: "Shirt or shorts", week: 3, essential: false, w: 1.5, why: "Light, quick-drying clothes. Any sportswear works to begin." },
      { id: "bag", category: "Badminton Bags", label: "Kit bag", week: 4, essential: false, w: 2, why: "Handy once you carry a racket, shoes and shuttles to the court." },
    ],
  },
  running: {
    label: "Marathon",
    blurb: "Shoes and socks first, then shorts and a top, then hydration for long runs.",
    needs: [
      { id: "shoes", category: "Running Shoes", label: "Running shoes", week: 1, essential: true, w: 4, why: "The purchase that matters most. Wear them in for a week before long runs." },
      { id: "socks", category: "Running Socks", label: "Running socks", week: 1, essential: true, w: 0.5, why: "Blister protection matters more the longer you run." },
      { id: "shorts", category: "Running Shorts", label: "Running shorts", week: 2, essential: true, w: 1, why: "Light, quick-drying shorts help avoid chafing." },
      { id: "top", category: "Running Tops", label: "Running top", week: 3, essential: false, w: 1.5, why: "Breathable layer for longer runs. Your current top may already do." },
      { id: "hydration", category: "Hydration & Nutrition", label: "Hydration belt or flask", week: 5, essential: false, w: 1.5, why: "Useful once your long runs pass about an hour." },
    ],
  },
  yoga: {
    label: "Yoga",
    blurb: "Start with clothing you can move in, then a mat for home practice.",
    needs: [
      { id: "pants", category: "Yoga Pants", label: "Yoga pants", week: 1, essential: true, why: "Clothing you can stretch in. Start here." },
      { id: "mat", category: "Yoga Mats", label: "Yoga mat", week: 2, essential: true, why: "For home practice. Skip it if your studio lends mats." },
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
  // Each item to buy gets a share of the budget in proportion to its weight; owned items cost nothing.
  const totalW = buying.reduce((t, n) => t + (n.w ?? 1), 0) || 1;
  const shareOf = (n: Need) => (budget * (n.w ?? 1)) / totalW;
  const lines: PlanLine[] = needs.map((need) => {
    const isOwned = owned.includes(need.id);
    const product = isOwned ? null : pickProduct(need.category, shareOf(need));
    // Items that fall after the window go into the last week, so nothing is dropped silently.
    return { need, product, owned: isOwned, week: Math.min(Math.max(need.week, 1), Math.max(weeks, 1)), share: shareOf(need) };
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
  const goal: Goal | null = /\b(badminton|shuttle\w*|racket|racquet)\b/.test(t) ? "badminton"
    : /\byoga\b/.test(t) ? "yoga"
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
