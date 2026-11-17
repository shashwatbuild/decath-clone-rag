/**
 * Size finder: turns body or foot measurements into a suggested size, then matches it to the
 * size options this product actually lists. It is an estimate; the product's own size chart wins.
 */
import type { Product } from "./types";

export type SizeMode = "apparel" | "shoe" | "frame";
export type Measures = { height?: number; weight?: number; foot?: number };
export type Suggestion = { label: string; option: string | null; note: string };

export function sizeMode(p: Product): SizeMode | null {
  if (p.sizes.length < 2) return null;
  if (p.category === "Yoga Pants" || p.category === "T-Shirts") return "apparel";
  if (p.category === "Running Shoes") return "shoe";
  if (p.category === "Cycles") return "frame";
  return null;
}

const LADDER = ["XS", "S", "M", "L", "XL", "2XL"];

/** "UK 10 - EU M (L29)" -> "M", "XXL" -> "2XL", "L" -> "L" */
function letterOf(option: string): string | null {
  const plain = option.trim().toUpperCase().replace("XXL", "2XL");
  if (LADDER.includes(plain)) return plain;
  const m = option.match(/EU\s*(XS|S|M|L|XL|2XL|XXL)\b/i);
  return m ? m[1].toUpperCase().replace("XXL", "2XL") : null;
}

const euOf = (option: string): number | null => {
  const m = option.match(/EU\s*(\d{2}(?:\.\d)?)/i);
  return m ? Number(m[1]) : null;
};

function apparelLetter(height: number, weight: number): string {
  let i = weight < 50 ? 0 : weight < 59 ? 1 : weight < 71 ? 2 : weight < 83 ? 3 : weight < 96 ? 4 : 5;
  if (height >= 182) i += 1;
  if (height <= 152) i -= 1;
  return LADDER[Math.min(LADDER.length - 1, Math.max(0, i))];
}

const NOTE = "This is an estimate. Between two sizes, pick the larger for a relaxed fit.";

export function suggest(p: Product, mode: SizeMode, m: Measures): Suggestion | null {
  if (mode === "shoe") {
    if (!m.foot || m.foot < 18 || m.foot > 34) return null;
    const eu = Math.round((m.foot + 1.5) * 1.5);
    const options = p.sizes.map((s) => ({ s, eu: euOf(s) })).filter((o): o is { s: string; eu: number } => o.eu !== null);
    const best = options.sort((a, b) => Math.abs(a.eu - eu) - Math.abs(b.eu - eu))[0];
    return { label: `EU ${eu}`, option: best && Math.abs(best.eu - eu) <= 1 ? best.s : null, note: "Measure your longer foot, standing, in the evening. " + NOTE };
  }
  let letter: string | null = null;
  if (mode === "frame") {
    if (!m.height || m.height < 120 || m.height > 230) return null;
    letter = m.height < 165 ? "S" : m.height < 175 ? "M" : m.height < 185 ? "L" : "XL";
  } else {
    if (!m.height || !m.weight || m.height < 120 || m.height > 230 || m.weight < 30 || m.weight > 200) return null;
    letter = apparelLetter(m.height, m.weight);
  }
  const option = p.sizes.find((s) => letterOf(s) === letter) ?? null;
  return { label: letter, option, note: NOTE };
}
