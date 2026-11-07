/**
 * Decision profiles: what matters when choosing in one category, and how each criterion is read
 * from catalogue facts. Facts only: if the catalogue doesn't list it, `classify` returns null and the
 * UI says "Not specified". Adding a sport = adding a profile here; the engine and UI are generic.
 */
import type { Product } from "@/lib/types";

export type Evidence = { source: "Specifications" | "Price" | "Reviews" | "Sizes" | "Stock" | "Weight"; field: string; value: string };
export type Option = { id: string; label: string; re?: RegExp };

export type Criterion = {
  id: string;
  /** "Coverage" */
  label: string;
  /** level = experience level, use = intended use, pref = other preference */
  role: "level" | "use" | "pref";
  question?: string;
  /** label for "no preference" / "not sure" */
  noneLabel: string;
  noneRe?: RegExp;
  options: Option[];
  /** may the shopper make this a must-have? */
  canBeMust: boolean;
  /** recorded in the brief but not checked against products (e.g. trip duration) */
  informational?: boolean;
  /** choosing a value sets other criteria (shown to the shopper as a stated assumption) */
  implies?: (value: string) => { values: Record<string, string>; note: string } | null;
  /** the catalogue fact this criterion is read from */
  fact?: (p: Product) => Evidence | null;
  /** option ids the product satisfies; null when the catalogue doesn't say */
  classify?: (p: Product) => string[] | null;
};

export type Control = { kind: "budget" } | { kind: "priority" } | { kind: "criterion"; id: string };

export type Profile = {
  id: ProfileId;
  category: string;
  activity: string;
  /** "yoga pants" */
  noun: string;
  criteria: Criterion[];
  priorities: Option[];
  budget: { min: number; max: number; step: number };
  /** spec names worth showing in "For your needs" even without a matching criterion */
  showWeight: boolean;
  /** "What changes if…?" controls, in order */
  controls: Control[];
};
export type ProfileId = "yoga-pants" | "yoga-mats" | "backpacks";

// ------------------------------------------------------------------ helpers

export const specOf = (p: Product, name: string) => p.specifications.find((s) => s.name.toLowerCase() === name.toLowerCase())?.value;
const specEvidence = (p: Product, name: string): Evidence | null => {
  const v = specOf(p, name);
  return v ? { source: "Specifications", field: name, value: v.replace(/,(?=\S)/g, ", ") } : null;
};

const level: Criterion = {
  id: "level",
  label: "Experience level",
  role: "level",
  question: "What's your experience level?",
  noneLabel: "Not specified",
  options: [
    { id: "beginner", label: "Beginner", re: /\b(beginners?|starting|just started|start(ing)? out|new to|first time|newbie|novice)\b/ },
    { id: "intermediate", label: "Intermediate", re: /\bintermediate\b/ },
    { id: "advanced", label: "Advanced", re: /\b(advanced|experienced|expert)\b/ },
  ],
  canBeMust: false,
  fact: (p) => specEvidence(p, "Level of practice"),
  classify: (p) => {
    const v = specOf(p, "Level of practice")?.toLowerCase();
    if (!v) return null;
    if (/all levels/.test(v)) return ["beginner", "intermediate", "advanced"];
    return ["beginner", "intermediate", "advanced"].filter((l) => v.includes(l));
  },
};

const practice = (question: string): Criterion => ({
  id: "practice",
  label: "Type of practice",
  role: "use",
  question,
  noneLabel: "Not sure",
  noneRe: /\b(not sure|don'?t know|any practice)\b/,
  options: [
    { id: "gentle", label: "Gentle", re: /\b(gentle|hatha|restorative|yin|prenatal|relax(ing|ed)?|stretch(ing)?)\b/ },
    { id: "active", label: "Active", re: /\b(active|dynamic|vinyasa|ashtanga|power yoga|hot yoga|intense)\b/ },
  ],
  canBeMust: false,
  fact: (p) => specEvidence(p, "Type of practice"),
  classify: (p) => {
    const v = specOf(p, "Type of practice")?.toLowerCase();
    if (!v) return null;
    return [...(/gentle/.test(v) ? ["gentle"] : []), ...(/dynamic/.test(v) ? ["active"] : [])];
  },
});

const litres = (p: Product): number | null => {
  const vol = specOf(p, "Volume (in l)");
  if (!vol) return null;
  const nums = [...vol.matchAll(/(\d+)\s*l/gi)].map((m) => Number(m[1]));
  const extra = Number(specOf(p, "Expandable volume")?.match(/(\d+)/)?.[1] ?? 0);
  return nums.length ? Math.max(...nums) + extra : null;
};

// ------------------------------------------------------------------ profiles

export const PROFILES: Record<ProfileId, Profile> = {
  "yoga-pants": {
    id: "yoga-pants",
    category: "Yoga Pants",
    activity: "Yoga",
    noun: "yoga pants",
    criteria: [
      level,
      practice("What type of yoga will you mostly do?"),
      {
        id: "coverage",
        label: "Coverage",
        role: "pref",
        question: "What length do you prefer?",
        noneLabel: "No preference",
        noneRe: /\b(any length|either length|no preference|don'?t mind|doesn'?t matter|other lengths?)\b/,
        options: [
          { id: "full", label: "Full length", re: /\b(full[- ]?length|full coverage|long|ankle[- ]length)\b/ },
          { id: "below", label: "Below knee", re: /\b(below[- ](the[- ])?knee|capri|3\/4|three[- ]quarter|cropped)\b/ },
        ],
        canBeMust: true,
        fact: (p) => specEvidence(p, "Type of length"),
        classify: (p) => {
          const v = specOf(p, "Type of length")?.toLowerCase();
          if (!v) return null;
          if (/\blong\b/.test(v)) return ["full"];
          if (/below the knee/.test(v)) return ["below"];
          return null; // e.g. "Japanese cut": listed, but not clearly either length
        },
      },
      {
        id: "pockets",
        label: "Pockets",
        role: "pref",
        noneLabel: "No preference",
        noneRe: /\b(pockets? (don'?t|doesn'?t) matter|no need for pockets)\b/,
        options: [{ id: "yes", label: "With pockets", re: /\b(with pockets?|has pockets?|need pockets?|want pockets?)\b/ }],
        canBeMust: true,
        fact: (p) => specEvidence(p, "Pocket") ?? specEvidence(p, "Number of pockets"),
        classify: (p) => {
          const v = (specOf(p, "Pocket") ?? specOf(p, "Number of pockets"))?.toLowerCase();
          if (!v) return null;
          return /without|pocket ?less/.test(v) ? [] : ["yes"];
        },
      },
    ],
    priorities: [
      { id: "match", label: "Best match to my preferences" },
      { id: "price", label: "Lowest price", re: /\b(cheapest|lowest price|lower price|cheaper|less expensive|most affordable|save money|sasta)\b/ },
    ],
    budget: { min: 500, max: 3000, step: 100 },
    showWeight: false,
    controls: [{ kind: "budget" }, { kind: "criterion", id: "coverage" }, { kind: "priority" }, { kind: "criterion", id: "practice" }],
  },

  "yoga-mats": {
    id: "yoga-mats",
    category: "Yoga Mats",
    activity: "Yoga",
    noun: "yoga mat",
    criteria: [
      level,
      practice("What type of yoga will you mostly do on it?"),
      {
        id: "thickness",
        label: "Cushioning",
        role: "pref",
        question: "What matters more in the mat?",
        noneLabel: "No preference",
        noneRe: /\b(any thickness|no preference|don'?t mind)\b/,
        options: [
          { id: "thick", label: "Thick (6 mm+)", re: /\b(thick|thicker|thickest|cushion(ed|ing)?|knees?|joints?|soft)\b/ },
          { id: "thin", label: "Thin (under 5 mm)", re: /\b(thin|thinner|travel)\b/ },
        ],
        canBeMust: true,
        fact: (p) => specEvidence(p, "Mat thickness (in mm)"),
        classify: (p) => {
          const mm = Number(specOf(p, "Mat thickness (in mm)")?.match(/[\d.]+/)?.[0]);
          if (!mm) return null;
          return mm >= 6 ? ["thick"] : mm < 5 ? ["thin"] : [];
        },
      },
      {
        id: "foldable",
        label: "Foldable",
        role: "pref",
        noneLabel: "No preference",
        options: [{ id: "yes", label: "Foldable", re: /\b(foldable|folds?|fold up)\b/ }],
        canBeMust: true,
        fact: (p) => specEvidence(p, "Foldable"),
        classify: (p) => {
          const v = specOf(p, "Foldable")?.toLowerCase();
          if (!v) return null;
          return /not foldable/.test(v) ? [] : ["yes"];
        },
      },
    ],
    priorities: [
      { id: "match", label: "Best match to my preferences" },
      { id: "price", label: "Lowest price", re: /\b(cheapest|lowest price|lower price|cheaper|most affordable|sasta)\b/ },
      { id: "weight", label: "Lightest to carry", re: /\b(lightest|lighter|light ?weight|easy to carry)\b/ },
    ],
    budget: { min: 300, max: 4000, step: 100 },
    showWeight: true,
    controls: [{ kind: "budget" }, { kind: "criterion", id: "thickness" }, { kind: "priority" }, { kind: "criterion", id: "practice" }],
  },

  backpacks: {
    id: "backpacks",
    category: "Backpacks",
    activity: "Trekking",
    noun: "trekking backpack",
    criteria: [
      level,
      {
        id: "duration",
        label: "Trip duration",
        role: "use",
        question: "How long are your trips usually?",
        noneLabel: "Not sure",
        options: [
          { id: "day", label: "Day hikes", re: /\b(day hikes?|day trips?|one day|1 day)\b/ },
          { id: "short", label: "2–3 days", re: /\b(2|3|two|three)[- ](to[- ])?(3[- ])?days?\b|\bweekend\b/ },
          { id: "long", label: "4+ days", re: /\b([4-9]|1\d|four|five|six|seven|week)[- ]?(\+|plus)?[- ]?(days?|weeks?)\b|\blong treks?\b/ },
        ],
        canBeMust: false,
        informational: true,
        implies: (v) =>
          v === "short" ? { values: { capacity: "40" }, note: "2–3 day trips: set minimum capacity to 40 L (a common rule of thumb; change it if you pack light)" }
          : v === "long" ? { values: { capacity: "60" }, note: "4+ day trips: set minimum capacity to 60 L (a common rule of thumb; change it if you pack light)" }
          : null,
      },
      {
        id: "capacity",
        label: "Minimum capacity",
        role: "pref",
        noneLabel: "Any capacity",
        options: [
          { id: "40", label: "40 L+", re: /\b(4\d)\s*(l|litres?|liters?)\b/ },
          { id: "60", label: "60 L+", re: /\b([6-9]\d)\s*(l|litres?|liters?)\b/ },
        ],
        canBeMust: true,
        fact: (p) => {
          const l = litres(p);
          return l ? { source: "Specifications", field: "Volume (in l)" + (specOf(p, "Expandable volume") ? " + Expandable volume" : ""), value: `${specOf(p, "Volume (in l)")}${specOf(p, "Expandable volume") ? ` (${specOf(p, "Expandable volume")})` : ""}` } : null;
        },
        classify: (p) => {
          const l = litres(p);
          if (!l) return null;
          return [...(l >= 40 ? ["40"] : []), ...(l >= 60 ? ["60"] : [])];
        },
      },
      {
        id: "raincover",
        label: "Rain cover",
        role: "pref",
        noneLabel: "No preference",
        options: [{ id: "yes", label: "Included", re: /\b(rain ?cover|monsoon|rain)\b/ }],
        canBeMust: true,
        fact: (p) => specEvidence(p, "Rain cover"),
        classify: (p) => {
          const v = specOf(p, "Rain cover")?.toLowerCase();
          if (!v) return null;
          return /not included/.test(v) ? [] : ["yes"];
        },
      },
    ],
    priorities: [
      { id: "match", label: "Best match to my preferences" },
      { id: "price", label: "Lowest price", re: /\b(cheapest|lowest price|lower price|cheaper|most affordable|sasta)\b/ },
      { id: "weight", label: "Lightest", re: /\b(lightest|lighter|light ?weight|ultra ?light)\b/ },
    ],
    budget: { min: 2000, max: 30000, step: 500 },
    showWeight: true,
    controls: [{ kind: "criterion", id: "duration" }, { kind: "criterion", id: "capacity" }, { kind: "priority" }, { kind: "budget" }],
  },
};

export const profileByCategory = (cat: string) => Object.values(PROFILES).find((p) => p.category === cat);
export const criterion = (profile: Profile, id: string) => profile.criteria.find((c) => c.id === id);
export const optionLabel = (c: Criterion, v: string | null | undefined) =>
  v === undefined ? "Not set" : v === null ? c.noneLabel : (c.options.find((o) => o.id === v)?.label ?? v);
