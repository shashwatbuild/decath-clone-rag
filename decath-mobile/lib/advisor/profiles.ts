/**
 * Decision profiles: what matters when choosing in one category, and how each criterion is read
 * from catalogue facts. Facts only: if the catalogue doesn't list it, `classify` returns null and the
 * UI says "Not specified". Adding a sport = adding a profile here; the engine and UI are generic.
 */
import type { Product } from "@/lib/types";

export type Evidence = { source: "Specifications" | "Price" | "Reviews" | "Sizes" | "Stock" | "Weight" | "Product name" | "Benefits"; field: string; value: string };
export type Option = { id: string; label: string; re?: RegExp; /** short definition shown on choice cards */ hint?: string };
/** A brief value: one option, several options (multi-select), or null for "no preference" */
export type Val = string | string[] | null;

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
  /** several options can be chosen (match = product satisfies any of them) */
  multi?: boolean;
  /** asked first, as visual cards */
  cards?: boolean;
  /** shown under "Refine my preferences" instead of being asked */
  refine?: boolean;
  /** "unknown" here means "not listed as a benefit", never a mismatch */
  benefitBased?: boolean;
  /** recorded in the brief but not checked against products (e.g. trip duration) */
  informational?: boolean;
  /** choosing a value sets other criteria (shown to the shopper as a stated assumption) */
  implies?: (value: string) => { values: Record<string, string>; note: string } | null;
  /** the catalogue fact this criterion is read from */
  fact?: (p: Product) => Evidence | null;
  /** option ids the product satisfies; null when the catalogue doesn't say */
  classify?: (p: Product) => string[] | null;
  /** short "listed" text for comparisons (defaults to the catalogue fact's value) */
  display?: (p: Product) => string | null;
};

export type Control = { kind: "budget" } | { kind: "priority" } | { kind: "criterion"; id: string } | { kind: "require"; id: string };

/** Activity kit: item categories that go with this activity */
export type KitItemDef = {
  id: string;
  label: string;
  /** catalogue category, or null when this demo catalogue doesn't stock it */
  category: string | null;
  essential: boolean;
  /** why it's (not) essential: shown to the shopper */
  basis: string;
  /** shown for "Not sure" */
  whenUseful: string;
  /** words that name this item in chat ("I already have a mat"); yoga items use a built-in list */
  words?: RegExp;
};

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
  /** follow-up questions asked after the first (cards) question, at most */
  maxQuestions?: number;
  kit?: KitItemDef[];
};
export type ProfileId = "yoga-pants" | "yoga-mats" | "backpacks" | "badminton-rackets" | "running-shoes";

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

const has = (p: Product, re: RegExp) => re.test(p.name);
const benefit = (p: Product, re: RegExp): Evidence | null => {
  const b = p.benefits.find((x) => re.test(x.name));
  return b ? { source: "Benefits", field: b.name, value: b.value } : null;
};
const COLOURS = ["Black", "Brown", "Grey", "Beige", "Blue", "Green", "Navy", "White", "Pink", "Purple", "Red"];
export const colourOfName = (p: Product): string | null => {
  const tail = p.name.match(/[-–,]\s*([A-Za-z ]+)$/)?.[1]?.trim();
  if (!tail) return null;
  return COLOURS.find((c) => new RegExp(`\\b${c}\\b`, "i").test(tail)) ?? null;
};

const YOGA_KIT: KitItemDef[] = [
  { id: "pants", label: "Yoga clothing (pants)", category: "Yoga Pants", essential: true, basis: "You need clothing you can move freely in. The pants you're shopping for cover this.", whenUseful: "Any comfortable clothing you can stretch in works to start." },
  { id: "mat", label: "Yoga mat", category: "Yoga Mats", essential: true, basis: "Most poses are done on a mat. Many studios lend mats, so you may not need your own if you only practise in class.", whenUseful: "Useful if you practise at home or your studio doesn't lend mats." },
  { id: "blocks", label: "Yoga blocks", category: null, essential: false, basis: "Optional. Blocks can help you reach poses while you build flexibility; you don't need them to start.", whenUseful: "Helpful if you can't yet reach the floor comfortably in standing poses." },
  { id: "strap", label: "Yoga strap", category: null, essential: false, basis: "Optional. A strap can extend your reach in stretches; a towel or belt can do the same job.", whenUseful: "Helpful for seated forward folds and shoulder stretches when you're less flexible." },
];

const practice = (question: string): Criterion => ({
  id: "practice",
  label: "Type of practice",
  role: "use",
  question,
  noneLabel: "Not sure",
  noneRe: /\b(not sure|don'?t know|any practice)\b/,
  options: [
    { id: "gentle", label: "Gentle", re: /\b(gentle|hatha|restorative|yin|prenatal|relax(ing|ed)?|stretch(ing)?)\b/ },
    { id: "active", label: "Active flow", re: /\b(active|dynamic|vinyasa|ashtanga|power yoga|hot yoga|intense|flow)\b/ },
    { id: "mixed", label: "Mixed", re: /\b(mixed|both|a mix|mix of)\b/ },
  ],
  canBeMust: false,
  fact: (p) => specEvidence(p, "Type of practice"),
  classify: (p) => {
    const v = specOf(p, "Type of practice")?.toLowerCase();
    if (!v) return null;
    const g = /gentle/.test(v), d = /dynamic/.test(v);
    return [...(g ? ["gentle"] : []), ...(d ? ["active"] : []), ...(g && d ? ["mixed"] : [])];
  },
});

const litres = (p: Product): number | null => {
  const vol = specOf(p, "Volume (in l)");
  if (!vol) return null;
  const nums = [...vol.matchAll(/(\d+)\s*l/gi)].map((m) => Number(m[1]));
  const extra = Number(specOf(p, "Expandable volume")?.match(/(\d+)/)?.[1] ?? 0);
  return nums.length ? Math.max(...nums) + extra : null;
};


const BADMINTON_KIT: KitItemDef[] = [
  { id: "racket", label: "Badminton racket", category: "Badminton Rackets", essential: true, basis: "Every player needs one. The racket you're shopping for covers this.", whenUseful: "Only needed if you don't already have one you like." , words: /\brackets?\b/},
  { id: "shuttles", label: "Shuttlecocks", category: "Shuttlecocks", essential: true, basis: "You can't play without them, and they wear out fast. Plastic shuttles last longer; feather shuttles fly truer and cost more.", whenUseful: "Handy to keep a spare tube even if the court supplies some." , words: /\bshuttles?(cocks?)?\b/},
  { id: "shoes", label: "Badminton shoes", category: "Badminton Shoes", essential: true, basis: "Court shoes give grip and cushioning for quick side-to-side moves on indoor courts. Running shoes aren't built for that.", whenUseful: "Useful before your first full game on a hard indoor court." , words: /\bshoes?\b/},
  { id: "apparel", label: "Shirt and shorts", category: "Badminton Apparel", essential: false, basis: "Optional. Any breathable sportswear works to begin; badminton clothing is light and lets you move freely.", whenUseful: "Helpful once you play regularly and want clothes that dry fast." , words: /\b(shirts?|t-?shirts?|shorts|clothes|clothing|apparel)\b/},
  { id: "bag", label: "Kit bag", category: "Badminton Bags", essential: false, basis: "Optional. Useful once you carry a racket, shoes and shuttles to the court.", whenUseful: "Helpful if you travel to a court or play with more than one racket." , words: /\b(kit ?)?bags?\b/},
  { id: "grip", label: "Grip", category: "Badminton Accessories", essential: false, basis: "Optional. A fresh grip stops the racket slipping when your hands sweat, and costs very little.", whenUseful: "Helpful if your hands sweat or your racket handle feels worn." , words: /\b(over)?grips?\b/},
];

const MARATHON_KIT: KitItemDef[] = [
  { id: "shoes", label: "Running shoes", category: "Running Shoes", essential: true, basis: "The most important purchase for a long run. The shoes you're shopping for cover this.", whenUseful: "Only needed if your current pair is worn out or wrong for the distance." , words: /\bshoes?\b/},
  { id: "shorts", label: "Running shorts", category: "Running Shorts", essential: true, basis: "Light, quick-drying shorts help avoid chafing over long distances.", whenUseful: "Any shorts you already run comfortably in will do." , words: /\bshorts\b/},
  { id: "socks", label: "Running socks", category: "Running Socks", essential: true, basis: "Cotton socks hold sweat; running socks help prevent blisters, which matter more the longer you run.", whenUseful: "Worth having a pair you have tested on long runs before race day." , words: /\bsocks?\b/},
  { id: "top", label: "Running top", category: "Running Tops", essential: false, basis: "Optional. Any breathable top works; a technical top can reduce chafing on long runs.", whenUseful: "Helpful for runs beyond about an hour." , words: /\b(top|singlet|tank|t-?shirt|shirt)\b/},
  { id: "hydration", label: "Hydration belt or flask", category: "Hydration & Nutrition", essential: false, basis: "Optional. Useful on long runs where you want fluids, gels and your phone on you.", whenUseful: "Helpful on runs over an hour, or where races have far-apart water points." , words: /\b(belt|flasks?|bottles?|hydration)\b/},
  { id: "cap", label: "Cap or visor", category: "Running Caps", essential: false, basis: "Optional. Shades your eyes and keeps sweat out in hot weather.", whenUseful: "Helpful for daytime runs in the sun." , words: /\b(cap|visor)\b/},
  { id: "watch", label: "GPS watch or heart-rate belt", category: "Running Watches", essential: false, basis: "Optional. Helps pace a long run and track training; you can start without one.", whenUseful: "Helpful when you follow a training plan with pace or heart-rate targets." , words: /\b(watch|gps|heart[- ]rate)\b/},
];

// ------------------------------------------------------------------ profiles

export const PROFILES: Record<ProfileId, Profile> = {
  "yoga-pants": {
    id: "yoga-pants",
    category: "Yoga Pants",
    activity: "Yoga",
    noun: "yoga pants",
    criteria: [
      level,
      {
        id: "type",
        label: "Pant type",
        role: "pref",
        question: "What type of yoga pants would you like?",
        noneLabel: "No preference",
        noneRe: /\b(any (type|style)|no preference|don'?t mind)\b/,
        multi: true,
        cards: true,
        options: [
          { id: "leggings", label: "Fitted leggings", hint: "Close-fitting, full or 7/8 length", re: /\b(leggings?|tights|fitted pants)\b/ },
          { id: "flared", label: "Flared yoga pants", hint: "Leg widens towards the ankle", re: /\b(flared?|flares|bootcut)\b/ },
          { id: "relaxed", label: "Relaxed or straight-fit pants", hint: "Loose, regular or straight cut, incl. dhoti and joggers", re: /\b(relaxed|loose|straight)[- ](fit )?(pants|trousers|trackpants|bottoms)\b|\b(dhoti|joggers?|harem)\b/ },
          { id: "capri", label: "Yoga capris", hint: "Shorter, below-the-knee length", re: /\bcapris?\b|\b3\/4 (pants|length)\b/ },
        ],
        canBeMust: true,
        fact: (p) => {
          const word = p.name.match(/\b(leggings|flared|capris?)\b/i)?.[0];
          if (word) return { source: "Product name", field: "Name", value: p.name };
          return specEvidence(p, "Fit");
        },
        display: (p) => {
          const word = p.name.match(/\b(leggings|flared|capris?)\b/i)?.[0];
          if (word) return `${word.charAt(0).toUpperCase()}${word.slice(1).toLowerCase()} (product name)`;
          const fit = specOf(p, "Fit");
          return fit ? `Relaxed (Fit: ${fit.replace(/,(?=\S)/g, ", ")})` : null;
        },
        classify: (p) => {
          if (has(p, /leggings/i) || /skinny/i.test(specOf(p, "Fit") ?? "")) return ["leggings"];
          if (has(p, /flared/i)) return ["flared"];
          if (has(p, /capri/i) || /below the knee/i.test(specOf(p, "Type of length") ?? "")) return ["capri"];
          if (/loose|regular|straight|classic/i.test(specOf(p, "Fit") ?? "")) return ["relaxed"];
          return null;
        },
      },
      {
        id: "fit",
        label: "Fit",
        role: "pref",
        question: "How do you like them to fit?",
        noneLabel: "No preference",
        noneRe: /\b(any fit|fit doesn'?t matter)\b/,
        options: [
          { id: "close", label: "Close-fitting", re: /\b(close[- ]fitting|tight|snug|skinny|body[- ]hugging)\b/ },
          { id: "regular", label: "Regular", re: /\bregular fit\b/ },
          { id: "relaxed", label: "Relaxed", re: /\b(relaxed|loose)( fit|[- ]fitting)\b/ },
        ],
        canBeMust: true,
        fact: (p) => specEvidence(p, "Fit"),
        classify: (p) => {
          const v = specOf(p, "Fit")?.toLowerCase();
          if (!v) return null;
          return [...(/skinny/.test(v) ? ["close"] : []), ...(/regular|classic|straight/.test(v) ? ["regular"] : []), ...(/loose/.test(v) ? ["relaxed"] : [])];
        },
      },
      practice("What kind of yoga will you mostly do?"),
      {
        id: "waist",
        label: "Waist",
        role: "pref",
        question: "Which waist height do you prefer?",
        noneLabel: "No preference",
        options: [
          { id: "high", label: "High-rise", re: /\b(high[- ]?(rise|waist(ed)?|waistband))\b/ },
          { id: "mid", label: "Mid-rise", re: /\b(mid[- ]?(rise|waist(ed)?|waistband))\b/ },
        ],
        canBeMust: true,
        fact: (p) => specEvidence(p, "Belt height"),
        classify: (p) => {
          const v = specOf(p, "Belt height")?.toLowerCase();
          if (!v) return null;
          return [...(/high/.test(v) ? ["high"] : []), ...(/mid/.test(v) ? ["mid"] : [])];
        },
      },
      {
        id: "pockets",
        label: "Pockets",
        role: "pref",
        noneLabel: "No preference",
        noneRe: /\b(pockets? (don'?t|doesn'?t) matter|no need for pockets)\b/,
        options: [{ id: "yes", label: "With pockets", re: /\b(with pockets?|has pockets?|need pockets?|want pockets?|pockets? (is|are) a must)\b/ }],
        canBeMust: true,
        fact: (p) => specEvidence(p, "Pocket") ?? specEvidence(p, "Number of pockets"),
        classify: (p) => {
          const v = (specOf(p, "Pocket") ?? specOf(p, "Number of pockets"))?.toLowerCase();
          if (!v) return null;
          return /without|pocket ?less/.test(v) ? [] : ["yes"];
        },
      },
      {
        id: "fabric",
        label: "Fabric",
        role: "pref",
        refine: true,
        noneLabel: "No preference",
        options: [
          { id: "cotton", label: "Cotton-rich", re: /\bcotton\b/ },
          { id: "synthetic", label: "Synthetic blend", re: /\b(synthetic|polyamide|polyester|nylon)\b/ },
        ],
        canBeMust: true,
        fact: (p) => specEvidence(p, "Main material"),
        classify: (p) => {
          const v = specOf(p, "Main material")?.toLowerCase();
          if (!v) return null;
          return [...(/cotton/.test(v) ? ["cotton"] : []), ...(/^(polyamide|polyester|polyethylene|elastane)/.test(v) ? ["synthetic"] : [])];
        },
      },
      {
        id: "feel",
        label: "Feel",
        role: "pref",
        refine: true,
        benefitBased: true,
        noneLabel: "No preference",
        options: [
          { id: "soft", label: "Soft", re: /\bsoft(er|ness)?\b/ },
          { id: "supportive", label: "Supportive", re: /\b(supportive|support|stable|stability)\b/ },
          { id: "flowing", label: "Light and flowing", re: /\b(flowing|lightweight|airy)\b/ },
        ],
        canBeMust: false,
        fact: (p) => benefit(p, /softness|stability|flowing/i),
        classify: (p) => {
          const out = [...(benefit(p, /softness/i) ? ["soft"] : []), ...(benefit(p, /stability/i) ? ["supportive"] : []), ...(benefit(p, /flowing/i) ? ["flowing"] : [])];
          return out.length ? out : null; // not listed as a benefit: unknown, never "doesn't match"
        },
      },
      {
        id: "adjustable",
        label: "Adjustable waistband",
        role: "pref",
        refine: true,
        noneLabel: "No preference",
        options: [{ id: "yes", label: "Adjustable (drawstring or adjustable belt)", re: /\b(adjustable waist(band)?|drawstring)\b/ }],
        canBeMust: true,
        fact: (p) => specEvidence(p, "Type of belt"),
        classify: (p) => {
          const v = specOf(p, "Type of belt")?.toLowerCase();
          if (!v) return null;
          return /adjustable|drawstring/.test(v) ? ["yes"] : [];
        },
      },
      {
        id: "use",
        label: "Use",
        role: "use",
        refine: true,
        noneLabel: "Yoga only",
        noneRe: /\b(just for yoga|yoga only|only for yoga)\b/,
        options: [{ id: "everyday", label: "Yoga and everyday wear", re: /\b(everyday|daily wear|office|lounge|casual|around town)\b/ }],
        canBeMust: false,
        fact: (p) => specEvidence(p, "Place of practice"),
        classify: (p) => {
          const v = specOf(p, "Place of practice")?.toLowerCase();
          return v && /office|city|urban/.test(v) ? ["everyday"] : null; // only listed places count
        },
      },
      {
        id: "colour",
        label: "Colour",
        role: "pref",
        refine: true,
        multi: true,
        noneLabel: "Any colour",
        options: ["Black", "Brown", "Grey", "Beige"].map((c) => ({ id: c.toLowerCase(), label: c, re: new RegExp(`\\b${c.toLowerCase()}\\b`) })),
        canBeMust: true,
        fact: (p) => { const c = colourOfName(p); return c ? { source: "Product name", field: "Colour in name", value: c } : null; },
        classify: (p) => { const c = colourOfName(p); return c ? [c.toLowerCase()] : null; },
      },
      {
        id: "length",
        label: "Length",
        role: "pref",
        refine: true,
        noneLabel: "No preference",
        noneRe: /\b(any length|either length|other lengths?)\b/,
        options: [
          { id: "full", label: "Full length", re: /\b(full[- ]?length|full coverage|ankle[- ]length)\b/ },
          { id: "78", label: "7/8 length", re: /\b7\/8\b/ },
          { id: "below", label: "Below knee", re: /\bbelow[- ](the[- ])?knee\b/ },
        ],
        canBeMust: true,
        fact: (p) => specEvidence(p, "Type of length"),
        classify: (p) => {
          const v = specOf(p, "Type of length")?.toLowerCase();
          if (!v) return null;
          if (/\blong\b/.test(v)) return ["full"];
          if (/7\/8/.test(v)) return ["78"];
          if (/below the knee/.test(v)) return ["below"];
          return null; // e.g. "Japanese cut"
        },
      },
    ],
    priorities: [
      { id: "match", label: "Best match to my preferences" },
      { id: "price", label: "Lowest price", re: /\b(cheapest|lowest price|lower price|cheaper|less expensive|most affordable|save money|sasta)\b/ },
    ],
    budget: { min: 500, max: 3000, step: 100 },
    showWeight: false,
    maxQuestions: 2,
    controls: [{ kind: "budget" }, { kind: "criterion", id: "type" }, { kind: "criterion", id: "fit" }, { kind: "criterion", id: "waist" }, { kind: "criterion", id: "fabric" }, { kind: "require", id: "pockets" }, { kind: "criterion", id: "practice" }, { kind: "priority" }],
    kit: YOGA_KIT,
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
    kit: YOGA_KIT,
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
  "badminton-rackets": {
    id: "badminton-rackets",
    category: "Badminton Rackets",
    activity: "Badminton",
    noun: "badminton racket",
    criteria: [
      level,
      {
        id: "style",
        label: "Racket style",
        role: "pref",
        question: "What kind of racket would you like?",
        noneLabel: "No preference",
        noneRe: /\b(any (type|kind|style)|no preference|don'?t mind)\b/,
        multi: true,
        cards: true,
        options: [
          { id: "easy", label: "Easy to handle", hint: "Light and forgiving, good for learning", re: /\b(easy to handle|easy|forgiving|light)\b/ },
          { id: "power", label: "Power", hint: "Head-heavy for harder smashes", re: /\b(power(ful)?|smash(es)?|attack(ing)?|aggressive)\b/ },
          { id: "control", label: "Control", hint: "Balanced for placement and precision", re: /\b(control|precision|placement|accura(te|cy))\b/ },
        ],
        canBeMust: true,
        fact: (p) => specEvidence(p, "Racket type"),
        classify: (p) => {
          const v = specOf(p, "Racket type")?.toLowerCase();
          if (!v) return null;
          return [...(/easy/.test(v) ? ["easy"] : []), ...(/power/.test(v) ? ["power"] : []), ...(/control/.test(v) ? ["control"] : [])];
        },
      },
      {
        id: "frequency",
        label: "How often you play",
        role: "use",
        question: "How often will you play?",
        noneLabel: "Not sure",
        noneRe: /\b(not sure|don'?t know)\b/,
        options: [
          { id: "occasional", label: "Occasionally, for fun", re: /\b(occasional(ly)?|casual(ly)?|for fun|weekends?|sometimes|leisure)\b/ },
          { id: "regular", label: "Regularly or in competition", re: /\b(regular(ly)?|often|every (day|week)|several times|competitive(ly)?|tournament|league|club|intensive(ly)?)\b/ },
        ],
        canBeMust: false,
        fact: (p) => specEvidence(p, "Frequency"),
        classify: (p) => {
          const v = specOf(p, "Frequency")?.toLowerCase();
          if (!v) return null;
          return [...(/occasional/.test(v) ? ["occasional"] : []), ...(/intensive|regular/.test(v) ? ["regular"] : [])];
        },
      },
      {
        id: "place",
        label: "Where you play",
        role: "use",
        question: "Where will you mostly play?",
        noneLabel: "Not sure",
        noneRe: /\b(not sure|don'?t know)\b/,
        options: [
          { id: "indoor", label: "Indoor court", re: /\b(indoors?|hall|stadium|court)\b/ },
          { id: "outdoor", label: "Outdoors", re: /\b(outdoors?|garden|park|backyard|lawn|beach|terrace)\b/ },
        ],
        canBeMust: true,
        fact: (p) => specEvidence(p, "Place of practice"),
        classify: (p) => {
          const v = specOf(p, "Place of practice")?.toLowerCase();
          if (!v) return null;
          return [...(/indoor/.test(v) ? ["indoor"] : []), ...(/outdoor/.test(v) ? ["outdoor"] : [])];
        },
      },
      {
        id: "balance",
        label: "Balance",
        role: "pref",
        refine: true,
        noneLabel: "No preference",
        options: [
          { id: "head", label: "Head-heavy (more power)", re: /\bhead[- ]heavy\b/ },
          { id: "even", label: "Even balance (more control)", re: /\b(even|balanced)\b/ },
        ],
        canBeMust: true,
        fact: (p) => specEvidence(p, "Balance"),
        classify: (p) => {
          const v = specOf(p, "Balance")?.toLowerCase();
          if (!v) return null;
          return [...(/head heavy/.test(v) ? ["head"] : []), ...(/even/.test(v) ? ["even"] : [])];
        },
      },
      {
        id: "set",
        label: "Racket set",
        role: "pref",
        refine: true,
        noneLabel: "No preference",
        options: [{ id: "set", label: "Sold as a set (extra rackets and shuttles)", re: /\b(set|pair|two rackets|family)\b/ }],
        canBeMust: true,
        fact: (p) => specEvidence(p, "Sold in set"),
        classify: (p) => {
          const v = specOf(p, "Sold in set")?.toLowerCase();
          if (!v) return null;
          return /sold alone/.test(v) ? [] : ["set"];
        },
      },
    ],
    priorities: [
      { id: "match", label: "Best match to my preferences" },
      { id: "price", label: "Lowest price", re: /\b(cheapest|lowest price|lower price|cheaper|most affordable|sasta)\b/ },
      { id: "weight", label: "Lightest", re: /\b(lightest|lighter|light ?weight|ultra ?light)\b/ },
    ],
    budget: { min: 300, max: 4000, step: 100 },
    showWeight: true,
    maxQuestions: 2,
    controls: [{ kind: "budget" }, { kind: "criterion", id: "style" }, { kind: "criterion", id: "frequency" }, { kind: "criterion", id: "place" }, { kind: "criterion", id: "balance" }, { kind: "criterion", id: "set" }, { kind: "priority" }],
    kit: BADMINTON_KIT,
  },

  "running-shoes": {
    id: "running-shoes",
    category: "Running Shoes",
    activity: "Marathon running",
    noun: "running shoes",
    criteria: [
      level,
      {
        id: "distance",
        label: "Race distance",
        role: "use",
        question: "What distance are you training for?",
        noneLabel: "Not sure",
        noneRe: /\b(not sure|don'?t know)\b/,
        multi: true,
        cards: true,
        options: [
          { id: "short", label: "Up to 10K", hint: "Everyday runs and short races", re: /\b(5 ?k|10 ?k|up to 10|short runs?|jogging|daily runs?)\b/ },
          { id: "half", label: "Half marathon", hint: "21 km training and race day", re: /\bhalf[- ]marathon\b|\b21 ?k(m)?\b/ },
          { id: "full", label: "Full marathon", hint: "42 km, long runs and race day", re: /\b(full )?marathon\b|\b42 ?k(m)?\b/ },
          { id: "trail", label: "Trail running", hint: "Off-road paths and hills", re: /\btrails?\b/ },
        ],
        canBeMust: true,
        fact: (p) => specEvidence(p, "Distance"),
        classify: (p) => {
          const v = specOf(p, "Distance")?.toLowerCase();
          if (!v) return null;
          return [
            ...(/1 to 10 km/.test(v) ? ["short"] : []),
            ...(/half marathon/.test(v) ? ["half"] : []),
            ...(/(^|,)\s*marathon/.test(v) ? ["full"] : []),
            ...(/trail/.test(v) ? ["trail"] : []),
          ];
        },
      },
      {
        id: "surface",
        label: "Where you run",
        role: "use",
        question: "Where will you mostly run?",
        noneLabel: "Not sure",
        noneRe: /\b(not sure|don'?t know)\b/,
        options: [
          { id: "road", label: "Road or track", re: /\b(roads?|pavement|street|track|tarmac|bitumen|treadmill)\b/ },
          { id: "trail", label: "Trails or hills", re: /\b(trails?|hills?|mountains?|off[- ]?road|forest)\b/ },
        ],
        canBeMust: true,
        fact: (p) => specEvidence(p, "Playing surface") ?? specEvidence(p, "Place of practice"),
        classify: (p) => {
          const v = (specOf(p, "Playing surface") ?? specOf(p, "Place of practice"))?.toLowerCase();
          if (!v) return null;
          return [...(/road|bitumen|athletics/.test(v) ? ["road"] : []), ...(/trail|path|piste|ground|mountain|rocks/.test(v) ? ["trail"] : [])];
        },
      },
      {
        id: "cushion",
        label: "Cushioning",
        role: "pref",
        question: "How much cushioning do you want?",
        noneLabel: "No preference",
        noneRe: /\b(any cushioning|no preference|don'?t mind)\b/,
        options: [
          { id: "max", label: "Maximum cushioning", re: /\b(max(imum)?|plush|softest|very soft)\b/ },
          { id: "high", label: "High cushioning", re: /\b(high|good|lots of) cushion(ing)?\b|\b(cushion(ed|ing)?|soft)\b/ },
        ],
        canBeMust: true,
        fact: (p) => specEvidence(p, "Cushioning level"),
        classify: (p) => {
          const v = specOf(p, "Cushioning level")?.toLowerCase();
          if (!v) return null;
          return /maximum/.test(v) ? ["max", "high"] : /high/.test(v) ? ["high"] : [];
        },
      },
      {
        id: "stride",
        label: "Stride type",
        role: "pref",
        refine: true,
        noneLabel: "Not sure",
        noneRe: /\b(not sure|don'?t know)\b/,
        options: [
          { id: "neutral", label: "Neutral", re: /\bneutral\b/ },
          { id: "pronator", label: "Pronator (feet roll inward)", re: /\b(pronat(or|ion|e)|flat feet|overpronat\w*)\b/ },
        ],
        canBeMust: true,
        fact: (p) => specEvidence(p, "Stride type"),
        classify: (p) => {
          const v = specOf(p, "Stride type")?.toLowerCase();
          if (!v) return null;
          return [...(/neutral/.test(v) ? ["neutral"] : []), ...(/pronator/.test(v) ? ["pronator"] : [])];
        },
      },
    ],
    priorities: [
      { id: "match", label: "Best match to my preferences" },
      { id: "price", label: "Lowest price", re: /\b(cheapest|lowest price|lower price|cheaper|most affordable|sasta)\b/ },
      { id: "weight", label: "Lightest", re: /\b(lightest|lighter|light ?weight|ultra ?light)\b/ },
    ],
    budget: { min: 1000, max: 15000, step: 500 },
    showWeight: true,
    maxQuestions: 2,
    controls: [{ kind: "budget" }, { kind: "criterion", id: "distance" }, { kind: "criterion", id: "surface" }, { kind: "criterion", id: "cushion" }, { kind: "criterion", id: "stride" }, { kind: "priority" }],
    kit: MARATHON_KIT,
  },
};

export const profileByCategory = (cat: string) => Object.values(PROFILES).find((p) => p.category === cat);
export const criterion = (profile: Profile, id: string) => profile.criteria.find((c) => c.id === id);
export const optionLabel = (c: Criterion, v: Val | undefined): string =>
  v === undefined ? "Not set"
  : v === null ? c.noneLabel
  : Array.isArray(v) ? (v.length ? v.map((x) => optionLabel(c, x)).join(" or ") : c.noneLabel)
  : (c.options.find((o) => o.id === v)?.label ?? v);
export const asList = (v: Val | undefined): string[] => (v === undefined || v === null ? [] : Array.isArray(v) ? v : [v]);
