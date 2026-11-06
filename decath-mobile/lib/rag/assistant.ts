/**
 * Shopping assistant: understands the shopper's message and builds a grounded reply on top of the
 * retriever in ./index.ts. Works offline; when an LLM is configured (./llm.ts) this reply is used as
 * the factual draft + the product cards / comparison table.
 *
 * Understands: categories & sports, budgets (under / above / between), gender & who it's for, kids,
 * superlatives (cheapest, lightest, best rated, on sale), products named by model ("kipride max",
 * "BR 100"), links / IDs, follow-ups ("the second one", "is it waterproof?", "which is cheaper?"),
 * comparisons, add-to-cart, store FAQs (returns, delivery, pickup, coupons), items we don't sell,
 * typos and a bit of Hinglish ("kitna price hai").
 */
import { boughtTogether, discountPct, getProduct, inr, products, similarProducts, toLite } from "@/lib/products";
import type { ChatMessage, Product } from "@/lib/types";
import { rankProducts, retrieve, tokenize } from "./index";

export type ChatRequest = {
  message: string;
  /** products shown in the last assistant reply */
  contextIds?: string[];
  /** the last multi-product list shown (for "the second one") */
  listIds?: string[];
  /** product page the chat was opened from */
  productId?: string;
  /** the last single product the conversation was about (for "it" after a list was shown) */
  lastFocusId?: string;
};
type Reply = Omit<ChatMessage, "role" | "time">;

// ------------------------------------------------------------------ vocabulary

/** Category nouns (after tokenize synonyms). A noun beats a sport word: "running t-shirt" = T-Shirts. */
const CATEGORY_NOUNS: Record<string, string[]> = {
  "Running Shoes": ["shoes"],
  "Yoga Pants": ["pants"],
  Backpacks: ["backpack"],
  Footballs: ["football"],
  "Yoga Mats": ["mat"],
  Badminton: ["badminton"],
  Cycles: ["cycle"],
  "T-Shirts": ["tshirt"],
};
const SPORT_WORDS: Record<string, string[]> = {
  yoga: ["Yoga Pants", "Yoga Mats"],
  pilates: ["Yoga Pants", "Yoga Mats"],
  running: ["Running Shoes"],
  marathon: ["Running Shoes"],
  jog: ["Running Shoes"],
  hiking: ["Backpacks"],
  camping: ["Backpacks"],
  gym: ["T-Shirts", "Yoga Mats"],
  fitness: ["T-Shirts", "Yoga Mats"],
  workout: ["T-Shirts", "Yoga Mats"],
  exercise: ["T-Shirts", "Yoga Mats"],
  mountain: ["Cycles"],
  commute: ["Cycles"],
};

/** Things shoppers ask for that this demo catalogue doesn't stock, with the closest thing we do have. */
const NOT_STOCKED: { re: RegExp; label: string; alt?: string }[] = [
  { re: /\b(table tennis|ping pong)\b/, label: "table tennis gear", alt: "Badminton" },
  { re: /\btennis\b/, label: "tennis gear", alt: "Badminton" },
  { re: /\bcricket\b/, label: "cricket gear" },
  { re: /\bswim(ming)?\b|\bgoggles?\b|\bswimsuit\b/, label: "swimming gear" },
  { re: /\b(basketball|volleyball|rugby|hockey)\b/, label: "that sport's equipment", alt: "Footballs" },
  { re: /\bgolf\b/, label: "golf gear" },
  { re: /\bbox(ing)?\b|\bpunching bag\b/, label: "boxing gear" },
  { re: /\b(skates?|skating|skateboards?|scooters?)\b/, label: "skates or scooters" },
  { re: /\b(dumbbells?|kettlebells?|barbells?|treadmills?|weights plates?)\b/, label: "gym equipment", alt: "Yoga Mats" },
  { re: /\b(tents?|sleeping bags?)\b/, label: "camping gear", alt: "Backpacks" },
  { re: /\b(helmets?|gloves?|watch(es)?|smartwatch|jackets?|shorts|socks|bottles?|caps?|sunglasses)\b/, label: "that item" },
];

const RE = {
  greet: /^(hi+|hello+|hey+|hola|namaste|yo|good (morning|afternoon|evening))\b[\s!.]*$/,
  thanks: /^(thanks?|thank you|thx|ty|ok(ay)?|cool|great|nice|awesome|perfect)\b[\s!.]*$/,
  compare: /\b(compare|comparison|vs\.?|versus|difference|differ|better than)\b/,
  addCart: /\b(add|put)\b.*\b(cart|bag|basket)\b|\badd (it|this|that|one|them)\b|\bbuy (it|this|that)\b|\b(i'?ll|i will) (take|buy) (it|this|that)\b/,
  price: /\b(price|cost|costs|how much|kitna|daam|rate|mrp)\b/,
  sizes: /\b(sizes?|fit|fits|fitting)\b/,
  warranty: /\b(warranty|guarantee)\b/,
  returns: /\b(return|returns|refund|exchange|replace|replacement)\b/,
  delivery: /\b(deliver(y|ed)?|shipping|ship|dispatch|arrive|how many days|when will)\b/,
  pickup: /\b(pick ?up|click and collect|store|stores|shop near|outlet)\b/,
  payment: /\b(payment|pay|cod|cash on delivery|emi|upi|credit card|debit card)\b/,
  coupon: /\b(coupons?|promos?|promo codes?|vouchers?|codes?)\b/,
  reviews: /\b(reviews?|ratings?|rated|feedback)\b/,
  material: /\b(made of|made from|material|fabric|composition|cotton|polyester|rubber|foam|aluminium|aluminum)\b/,
  weight: /\b(weight|weigh|weighs|heavy|kg|light)\b/,
  beginner: /\b(beginners?|newbie|starter|first time|just starting|starting out|new to)\b/,
  sale: /\b(sale|deals?|discount(s|ed)?|offers?|clearance|price drop|cheap deals)\b/,
  pick: /\b(which (one|is|should)|what should i (buy|get|choose)|recommend|suggest|best one|better one)\b/,
  listing: /\b(show|list|all|options|suggest|recommend|want|need|looking|buy|get|have|something|anything|gift)\b/,
  ordinal: /\b(first|1st|second|2nd|third|3rd|fourth|4th|fifth|5th|last|top)\s+(one|option|item|product|pick)?\b|\b(?:number|no\.?|option|#)\s*([1-5])\b/,
  kidAge: /\b(\d{1,2})\s*(?:-|\s)?(?:years?|yrs?|yr)\s*old\b|\b(kids?|child|children|junior|toddler)\b/,
};

const ORDINALS: Record<string, number> = { first: 0, "1st": 0, top: 0, second: 1, "2nd": 1, third: 2, "3rd": 2, fourth: 3, "4th": 3, fifth: 4, "5th": 4 };

// ------------------------------------------------------------------ parsing helpers

type PriceRange = { min?: number; max?: number };

function parseAmount(s: string) {
  const m = s.replace(/,/g, "").match(/(\d+(?:\.\d+)?)\s*(k)?/i);
  return m ? Math.round(Number(m[1]) * (m[2] ? 1000 : 1)) : NaN;
}

/** Budget phrases: "under 2k", "below ₹1,500", "1000 se kam", "above 5000", "between 1000 and 3000", "1k-3k". */
function parsePrice(text: string): { range: PriceRange | null; rest: string } {
  const t = text.toLowerCase().replace(/,(?=\d{3})/g, "");
  const num = String.raw`(?:rs\.?|₹|inr)?\s*(\d+(?:\.\d+)?\s*k?)\b`;
  const patterns: [RegExp, (m: RegExpMatchArray) => PriceRange][] = [
    [new RegExp(String.raw`\b(?:between|from)\s+${num}\s*(?:and|to|-)\s*${num}`), (m) => ({ min: parseAmount(m[1]), max: parseAmount(m[2]) })],
    [new RegExp(String.raw`${num}\s*(?:-|to)\s*${num}`), (m) => ({ min: parseAmount(m[1]), max: parseAmount(m[2]) })],
    [new RegExp(String.raw`\b(?:under|below|less than|within|upto|up to|max(?:imum)?|budget(?: of| is)?|cheaper than|not more than)\s*${num}`), (m) => ({ max: parseAmount(m[1]) })],
    [new RegExp(String.raw`${num}\s*(?:se kam|or less|and below|max)\b`), (m) => ({ max: parseAmount(m[1]) })],
    [new RegExp(String.raw`\b(?:above|over|more than|at least|minimum|min)\s*${num}`), (m) => ({ min: parseAmount(m[1]) })],
  ];
  for (const [re, f] of patterns) {
    const m = t.match(re);
    if (m) {
      const r = f(m);
      if ((r.min === undefined || r.min >= 50) && (r.max === undefined || r.max >= 50)) return { range: r, rest: t.replace(m[0], " ") };
    }
  }
  return { range: null, rest: t };
}

function detectCategories(tokens: string[]): string[] {
  const nouns = Object.entries(CATEGORY_NOUNS).filter(([, ws]) => ws.some((w) => tokens.includes(w))).map(([c]) => c);
  if (nouns.length) return nouns;
  const sports = new Set<string>();
  for (const [w, cats] of Object.entries(SPORT_WORDS)) if (tokens.includes(w)) cats.forEach((c) => sports.add(c));
  return [...sports];
}

function detectGender(lower: string): "Women" | "Men" | null {
  const w = /\b(women|woman|womens|ladies|lady|female|girls?|wife|girlfriend|gf|mother|mom|mum|sister|her|she)\b/.test(lower);
  const m = /\b(men|man|mens|male|boys?|husband|boyfriend|bf|father|dad|brother|him|he)\b/.test(lower);
  return w && !m ? "Women" : m && !w ? "Men" : null;
}

function detectSort(lower: string): "price_asc" | "price_desc" | "light" | "heavy" | "thick" | "best" | "discount" | "new" | null {
  if (/\b(thick|thicker|thickest|extra cushion|cushioned mat|knees?|joints?)\b/.test(lower) && /\bmats?\b/.test(lower)) return "thick";
  if (/\b(cheapest|cheaper|lowest price|least expensive|most affordable|budget|affordable|cheap|sasta)\b/.test(lower)) return "price_asc";
  if (/\b(most expensive|costliest|premium|high[- ]end|top of the range|best quality)\b/.test(lower)) return "price_desc";
  if (/\b(lightest|lighter|light ?weight|ultra[- ]?light)\b/.test(lower)) return "light";
  if (/\b(heaviest|heavier|sturdiest)\b/.test(lower)) return "heavy";
  if (/\b(newest|latest|new arrivals?|new)\b/.test(lower)) return "new";
  if (RE.sale.test(lower)) return "discount";
  if (/\b(best|top|popular|most reviewed|highest rated|best rated|best selling|bestseller)\b/.test(lower)) return "best";
  return null;
}

/** Mat thickness in mm from the product name ("8 mm", "1.3mm") */
const thickness = (p: Product) => Number(p.name.match(/(\d+(?:\.\d+)?)\s*mm\b/i)?.[1] ?? 0);
const popularity = (p: Product) => p.rating * Math.log10(p.reviewCount + 10);

function sortBy(ps: Product[], key: ReturnType<typeof detectSort>) {
  const by: Record<string, (a: Product, b: Product) => number> = {
    price_asc: (a, b) => a.price - b.price,
    price_desc: (a, b) => b.price - a.price,
    light: (a, b) => (a.weightKg ?? 99) - (b.weightKg ?? 99),
    heavy: (a, b) => (b.weightKg ?? 0) - (a.weightKg ?? 0),
    thick: (a, b) => thickness(b) - thickness(a),
    best: (a, b) => popularity(b) - popularity(a),
    discount: (a, b) => discountPct(b) - discountPct(a),
    new: (a, b) => Number(b.tag === "New arrival") - Number(a.tag === "New arrival") || popularity(b) - popularity(a),
  };
  return key ? [...ps].sort(by[key]) : ps;
}

// ---- products named in the message ("kipride max", "BR 100", "the MT900") ----

const NAME_TOKENS = new Map(products.map((p) => [p.id, new Set(tokenize(`${p.shortName} ${p.name}`))]));
/** Words that identify a model. Descriptive words ("max", "light", "gym", "thick") are not enough on their own. */
const MODEL_WORDS = new Set(["kipride", "kipcore", "kipclimb", "ks900", "triban", "rc100", "rockrider", "explore", "st120", "riverside", "sportee", "symbium", "mt100", "mt500", "mt900", "br", "lite", "thermobonded", "dhoti", "velour", "capri", "compression"]);
const isModelToken = (t: string) => MODEL_WORDS.has(t) || (/\d/.test(t) && (/[a-z]/.test(t) || t.length >= 3));
const NAME_DF = new Map<string, number>();
for (const toks of NAME_TOKENS.values()) for (const t of toks) NAME_DF.set(t, (NAME_DF.get(t) ?? 0) + 1);

function bestNamed(segment: string): { p: Product; score: number } | null {
  const q = new Set(tokenize(segment));
  let best: { p: Product; score: number } | null = null;
  for (const p of products) {
    const toks = NAME_TOKENS.get(p.id)!;
    let score = 0, distinctive = 0;
    for (const t of q) if (toks.has(t)) {
      const df = NAME_DF.get(t) ?? 1;
      score += Math.log(1 + products.length / df);
      if (df <= 3 && isModelToken(t)) distinctive++;
    }
    if (distinctive && (!best || score > best.score)) best = { p, score };
  }
  return best;
}

/** Products the shopper names, in order. Splits "A vs B", "A and B", "A, B". */
function namedProducts(text: string): Product[] {
  const segments = text.split(/\s+(?:vs\.?|versus|and|or|with|&)\s+|,|\bor\b/i).filter((s) => s.trim());
  const found: Product[] = [];
  for (const seg of segments.length > 1 ? segments : [text]) {
    const hit = bestNamed(seg);
    if (hit && !found.includes(hit.p)) found.push(hit.p);
  }
  return found;
}

function idsInMessage(msg: string) {
  return [...new Set([...msg.matchAll(/(?:\/(?:qr|p)\/)?\b(\d{7,10})\b/g)].map((m) => m[1]))].filter((id) => getProduct(id));
}

function ordinalPick(lower: string, list: Product[]): Product | null {
  if (!list.length) return null;
  if (/\b(last one|the last)\b/.test(lower)) return list[list.length - 1];
  const m = lower.match(RE.ordinal);
  if (!m) return null;
  const idx = m[3] ? Number(m[3]) - 1 : ORDINALS[m[1]];
  return idx !== undefined && list[idx] ? list[idx] : null;
}

function sizeIn(lower: string, sizes: string[]): string | null {
  const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  for (const s of sizes) {
    const parts = s.toLowerCase().split(/\s*-\s*/); // "UK 8 - EU 42" -> ["uk 8", "eu 42"]
    for (const part of [s.toLowerCase(), ...parts]) {
      const re = new RegExp(`(^|[\\s,(])(?:size\\s*)?${esc(part)}(?=$|[\\s,).!?])`);
      if (re.test(lower)) return s;
    }
  }
  return null;
}

// ------------------------------------------------------------------ text helpers

const name = (p: Product) => p.shortName;
const ratingText = (p: Product) => (p.reviewCount ? `★ ${p.rating} (${p.reviewCount.toLocaleString("en-IN")})` : "New, no reviews yet");
const spec = (p: Product, n: string) => p.specifications.find((s) => s.name.toLowerCase() === n.toLowerCase())?.value.replace(/,(?=[A-Za-z])/g, ", ");
/** One product row: "1. **Name**" then an indented details line (rendered as a muted second line). */
const line = (p: Product, extra?: string, i?: number) =>
  `${i !== undefined ? `${i + 1}.` : "-"} **${name(p)}**\n   ${inr(p.price)}${p.mrp > p.price ? ` ~~${inr(p.mrp)}~~` : ""} · ${ratingText(p)}${extra ? ` · ${extra}` : ""}`;
const productRows = (ps: Product[], extra?: (p: Product) => string | undefined) => ps.map((p, i) => line(p, extra?.(p), i)).join("\n");
const lite = (ps: Product[]) => ps.map(toLite);

/** Honest wording for "why this one on reviews": higher rating vs. simply more reviews. */
function reviewReason(winner: Product, others: Product[]) {
  const higherRated = others.find((o) => o.rating > winner.rating);
  return higherRated
    ? `it's the most proven: ${winner.reviewCount.toLocaleString("en-IN")} reviews at ★ ${winner.rating} (${name(higherRated)} rates a little higher at ★ ${higherRated.rating}, but from ${higherRated.reviewCount.toLocaleString("en-IN")} reviews)`
    : `it has the best reviews (${ratingText(winner)})`;
}

function beginnerScore(p: Product) {
  const level = (spec(p, "Level of practice") ?? "").toLowerCase();
  const text = `${p.name} ${p.description} ${p.technicalInformation.map((t) => t.value).join(" ")}`.toLowerCase();
  return (/beginner|all levels|occasional|discover|starter|easy/.test(level) ? 3 : 0) + (/beginner|starter|easy|gentle/.test(text) ? 1 : 0) + (p.price < 2000 ? 0.5 : 0) + p.rating / 5;
}

/** A short fact from the product that matches the shopper's words, for "why this one". */
function whyFor(p: Product, query: string): string | null {
  const hits = retrieve(query, { productIds: [p.id], k: 5 }).filter((h) => h.chunk.kind !== "overview" && h.chunk.kind !== "service");
  const hit = hits.find((h) => h.chunk.kind === "benefit" || h.chunk.kind === "spec") ?? hits[0];
  if (!hit) return null;
  const t = hit.chunk.text.replace(/\s+/g, " ").trim();
  return t.length > 140 ? t.slice(0, 137).replace(/\s\S*$/, "") + "…" : t;
}

// ------------------------------------------------------------------ main entry

export function respond(req: ChatRequest): Reply {
  const msg = req.message.trim();
  const lower = msg.toLowerCase();
  const { range, rest } = parsePrice(msg);
  const tokens = tokenize(rest);
  const cats = detectCategories(tokens);
  const gender = detectGender(lower);
  const sort = detectSort(lower);

  const ctx = (req.contextIds ?? []).map(getProduct).filter(Boolean) as Product[];
  const list = ((req.listIds?.length ? req.listIds : req.contextIds) ?? []).map(getProduct).filter(Boolean) as Product[];
  const page = req.productId ? getProduct(req.productId) : undefined;
  const lastFocus = req.lastFocusId ? getProduct(req.lastFocusId) : undefined;
  const linked = idsInMessage(msg).map((id) => getProduct(id)!);
  const ordinal = ordinalPick(lower, list);
  const named = linked.length ? linked : ordinal ? [] : namedProducts(rest.replace(/https?:\/\/\S+/g, " "));
  /** The single product this message is about, if any */
  const focus: Product | undefined = named[0] ?? ordinal ?? (ctx.length === 1 ? ctx[0] : undefined) ?? (ctx.length === 0 ? page : undefined);

  if (RE.greet.test(lower)) return greet();
  if (RE.thanks.test(lower)) return { text: "You're welcome! 😊 Anything else I can help you find?", suggestions: ["Show me running shoes", "What's on sale?", "Yoga mats for beginners"] };

  // Add to cart
  if (RE.addCart.test(lower)) {
    const current = ctx.length === 1 ? ctx[0] : page;
    const target = (current && current.sizes.length > 1 && sizeIn(lower, current.sizes) ? current : undefined) ?? named[0] ?? ordinal ?? current;
    return target ? addToCart(target, lower) : { text: "Which product should I add? Tap one of the cards above, or tell me its name.", products: lite(ctx.slice(0, 6)) };
  }

  // Compare
  if (RE.compare.test(lower)) {
    const pool = named.length >= 2 ? named : named.length === 1 ? [named[0], ...ctx.filter((p) => p !== named[0])] : ctx.length >= 2 ? ctx : list.length >= 2 ? list : page ? [page] : [];
    return compare(pool, tokens, lower, cats);
  }

  // Store questions that aren't about one product
  const aboutProduct = Boolean(named.length || ordinal) || (Boolean(focus) && !cats.length);
  if (!aboutProduct || !(RE.warranty.test(lower) || RE.price.test(lower) || RE.sizes.test(lower))) {
    const faq = storeFaq(lower, Boolean(named.length || ordinal || cats.length));
    if (faq) return faq;
  }

  // "Show similar products" / "What else goes with it?" about the product being discussed
  const about = named[0] ?? ordinal ?? (ctx.length === 1 ? ctx[0] : undefined) ?? (/\b(it|this|that)\b/.test(lower) ? lastFocus : undefined) ?? page;
  if (about && /\b(similar|alternatives?|other options|like (this|that|it))\b/.test(lower) && !cats.length) {
    const sims = sortBy(similarProducts(about), "best");
    return {
      text: `**Similar to the ${name(about)}** 👇\n\n${productRows(sims.slice(0, 5))}`,
      products: lite(sims),
      suggestions: sims.length ? [`Compare ${name(about)} vs ${name(sims[0])}`, `Tell me more about ${name(sims[0])}`] : [],
    };
  }
  if (about && /\b(goes with|go with|pair(s)? with|complete the look|bought together|accessor(y|ies)|what else)\b/.test(lower)) {
    const fbt = boughtTogether(about, 4);
    return {
      text: `**Goes well with the ${name(about)}** 👇\n\n${productRows(fbt)}`,
      products: lite(fbt),
      suggestions: fbt.length ? [`Add ${name(fbt[0])} to cart`, "View my cart"] : [],
    };
  }

  // Items we don't sell
  const notStocked = NOT_STOCKED.find((n) => n.re.test(lower));
  if (notStocked && !named.length && cats.every((c) => c === notStocked.alt || (c === "Badminton" && /\brackets?\b/.test(lower)))) {
    const alt = notStocked.alt ? products.filter((p) => p.category === notStocked.alt) : [];
    return {
      text:
        `Sorry, we don't stock **${notStocked.label}** yet.\n\nWe carry running shoes, yoga pants & mats, trekking backpacks, footballs, badminton rackets, cycles and gym t-shirts.` +
        (alt.length ? `\n\n> 💡 The closest thing we have: **${notStocked.alt!.toLowerCase()}**, shown below.` : ""),
      products: lite(sortBy(alt, "best").slice(0, 4)),
      suggestions: alt.length ? [`Show ${notStocked.alt!.toLowerCase()}`, "What's on sale?"] : ["Show me running shoes", "What's on sale?"],
    };
  }

  // A question about one specific product
  if (named.length === 1 || ordinal || (focus && !cats.length && !range && !RE.listing.test(lower) && !(sort && ctx.length > 1))) {
    const p = named[0] ?? ordinal ?? focus!;
    const leftover = tokenize(rest.replace(/https?:\/\/\S+/g, " ")).filter((t) => !NAME_TOKENS.get(p.id)!.has(t));
    return leftover.length === 0 || /\b(tell me (more )?about|more (details|info)|details (of|on|about)|describe|what is (it|this|that))\b/.test(lower) ? summary(p) : answerAboutProduct(p, msg, lower);
  }

  // "Which one is cheaper / better for beginners?" about the products just shown
  if ((RE.pick.test(lower) || sort) && !cats.length && !range && ctx.length > 1) return pickFrom(ctx, lower);

  // Listing / recommendation
  if (cats.length || range || gender || sort || RE.listing.test(lower) || RE.kidAge.test(lower))
    return listing({ msg, lower, tokens, cats, range, gender, sort });

  return fallback(msg, lower);
}

// ------------------------------------------------------------------ intents

function greet(): Reply {
  return {
    text: "Hi! 👋 I'm your **Decathlon shopping assistant**.\n\nTell me what you need (a sport, a budget, who it's for) and I'll:\n- find the right gear\n- explain features and sizes\n- compare options\n- add things to your cart",
    suggestions: ["Running shoes for a marathon", "Yoga mat for beginners under ₹1000", "Compare Kipride Max vs Kipcore Premium", "What's on sale?"],
  };
}

function addToCart(p: Product, lower: string): Reply {
  const size = p.sizes.length > 1 ? sizeIn(lower, p.sizes) : (p.sizes[0] ?? null);
  if (p.sizes.length > 1 && !size)
    return {
      text: `Sure! Which size of the **${name(p)}** would you like?\n\n**Available:** ${p.sizes.join(" · ")}`,
      products: lite([p]),
      suggestions: p.sizes.slice(0, 6).map((s) => `Add size ${s} to cart`),
    };
  return {
    text: `✅ Added **${name(p)}**${size && !/one size|no size/i.test(size) ? ` (size ${size})` : ""} to your cart · ${inr(p.price)}${p.offers[0] ? `\n\n> 🏷️ Offer: ${p.offers[0]}` : ""}`,
    products: lite([p]),
    action: { type: "add_to_cart", productId: p.id, size },
    suggestions: ["View my cart", "Show similar products", "What else goes with it?"],
  };
}

function storeFaq(lower: string, hasProductContext: boolean): Reply | null {
  if (RE.returns.test(lower))
    return { text: "**Returns & exchange**\n\n- Return or exchange most products within **30 days** of delivery\n- Most products also carry a **2-year warranty** against manufacturing defects\n- Each product page shows its exact warranty", suggestions: ["How fast is delivery?", "Can I pick up from a store?"] };
  if (RE.delivery.test(lower) && !hasProductContext)
    return { text: "**Delivery**\n\n- Standard delivery usually takes **3–5 days**; each product page shows the exact date for your pincode\n- **Free shipping** on orders of ₹999 or more (₹99 below that)\n- Or **pick up from a store** within 2 hours, free", suggestions: ["What's the return policy?", "Any coupons?"] };
  if (RE.pickup.test(lower) && !hasProductContext)
    return { text: "**Store pickup**\n\n- Choose **Pick up from store** on a product page\n- Collect it within **2 hours**, free of charge\n- Tap **View Stores** to see stores near you", suggestions: ["How fast is delivery?", "What's the return policy?"] };
  if (RE.coupon.test(lower))
    return { text: "**Coupons you can use now** 🏷️\n\n- **NC100**: ₹100 off orders above ₹1,499\n- **NC200**: ₹200 off orders above ₹2,499\n- **NC300**: ₹300 off orders above ₹3,499\n\nApply them on the cart page.", suggestions: ["What's on sale?", "View my cart"] };
  if (RE.payment.test(lower))
    return { text: "This is a demo store, so checkout and payments are switched off. You can still browse, add to cart, apply coupons and compare products.", suggestions: ["Any coupons?", "What's on sale?"] };
  if (RE.warranty.test(lower) && !hasProductContext)
    return { text: "**Warranty**\n\n- Most products: **2 years** against manufacturing defects\n- Plus **30-day** returns and exchange\n\nAsk me about a specific product to see its exact warranty.", suggestions: ["Warranty on Rockrider ST120 MTB", "What's the return policy?"] };
  return null;
}

function listing(o: { msg: string; lower: string; tokens: string[]; cats: string[]; range: PriceRange | null; gender: "Women" | "Men" | null; sort: ReturnType<typeof detectSort> }): Reply {
  const { lower, tokens, cats, range, gender } = o;
  let sort = o.sort;
  const kid = lower.match(RE.kidAge);
  const kidAge = kid?.[1] ? Number(kid[1]) : kid ? 10 : null;

  let pool = cats.length ? products.filter((p) => cats.includes(p.category)) : products;
  const noCategory = !cats.length;

  // Words beyond category / budget / filler: what the shopper actually wants ("cushion", "mountain", "travel")
  const nounGiven = cats.some((c) => (CATEGORY_NOUNS[c] ?? []).some((w) => tokens.includes(w)));
  const ownSportWords = Object.entries(SPORT_WORDS).filter(([, cs]) => cs.some((c) => cats.includes(c))).map(([w]) => w);
  const catWords = new Set([...cats.flatMap((c) => CATEGORY_NOUNS[c] ?? []), ...(nounGiven ? ownSportWords : Object.keys(SPORT_WORDS))]);
  const filler = /^(\d+k?|day|days|year|years|old|someone|something|anything|gift|buy|show|want|need|looking|options?|under|below|above|over|between|cheap|cheapest|best|top|lightest|sale|deals?|women|men|wife|husband|kids?|price|range|everything|products?|items?|stuff|gear|equipment|sport|sports|likes?|loves?|plays?|does|who|doing|into|play|practice|practices|starting|start|started|im|am|my|our|suggest|recommend|good|nice|great|buy|purchase|thing|things)$/;
  const extra = tokens.filter((t) => !catWords.has(t) && !filler.test(t)).join(" ");

  if (noCategory) {
    if (extra) {
      const ranked = rankProducts(extra).filter((r) => r.score > 2.5);
      if (ranked.length) pool = ranked.map((r) => getProduct(r.id)!).slice(0, 8);
    } else if (!range && !sort && !gender) {
      sort = "best";
    }
  } else if (extra) {
    const score = new Map(rankProducts(extra, pool.map((p) => p.id)).map((r) => [r.id, r.score]));
    pool = [...pool].sort((a, b) => (score.get(b.id) ?? 0) - (score.get(a.id) ?? 0));
  }

  if (gender) pool = pool.filter((p) => p.gender === gender || p.gender === "Unisex");
  if (range) pool = pool.filter((p) => (range.min === undefined || p.price >= range.min) && (range.max === undefined || p.price <= range.max));
  if (sort === "discount" && noCategory) pool = products.filter((p) => discountPct(p) >= 35 || p.tag === "Price drop" || p.tag === "Clearance");
  if (sort === "discount") pool = pool.filter((p) => discountPct(p) > 0);
  if ((/\bbeginners?\b/.test(tokens.join(" ")) || RE.beginner.test(lower)) && !sort) pool = [...pool].sort((a, b) => beginnerScore(b) - beginnerScore(a));
  pool = sortBy(pool, sort ?? (extra || RE.beginner.test(lower) ? null : "best"));

  const LABEL: Record<string, string> = { Badminton: "badminton rackets", "T-Shirts": "t-shirts", Cycles: "cycles" };
  const what = cats.length === 1 ? (LABEL[cats[0]] ?? cats[0].toLowerCase()) : "products";
  const budget = range ? (range.min && range.max ? ` between ${inr(range.min)} and ${inr(range.max)}` : range.max ? ` under ${inr(range.max)}` : ` above ${inr(range.min!)}`) : "";
  const forWhom = gender ? ` for ${gender.toLowerCase()}` : "";

  if (!pool.length) {
    const nearest = cats.length ? sortBy(products.filter((p) => cats.includes(p.category)), "price_asc").slice(0, 3) : [];
    return {
      text: `I couldn't find **${what}${forWhom}${budget}**.` + (nearest.length ? `\n\nThe most affordable ${what} start at **${inr(nearest[0].price)}**:\n\n${productRows(nearest)}` : "\n\nTry a different budget or category."),
      products: lite(nearest),
      suggestions: ["Show all categories", "What's on sale?"],
    };
  }

  const shown = pool.slice(0, 5);
  const extraInfo = (p: Product) =>
    sort === "light" || sort === "heavy" ? (p.weightKg ? `${p.weightKg} kg` : undefined)
    : sort === "thick" ? (thickness(p) ? `${thickness(p)} mm thick` : undefined)
    : sort === "discount" ? `${discountPct(p)}% off` : undefined;
  const top = pool[0];
  let why: string;
  switch (sort) {
    case "price_asc": why = `**My pick: ${name(top)}**, the most affordable at ${inr(top.price)}.`; break;
    case "price_desc": why = `**My pick: ${name(top)}**, the top-of-the-range option at ${inr(top.price)}.`; break;
    case "light": why = `**My pick: ${name(top)}**, the lightest${top.weightKg ? ` at about ${top.weightKg} kg` : ""}.`; break;
    case "thick": why = `**My pick: ${name(top)}**, the thickest at ${thickness(top)} mm, so the most cushioning for knees and joints.`; break;
    case "heavy": why = `**My pick: ${name(top)}**, the sturdiest at about ${top.weightKg} kg.`; break;
    case "discount": why = `**Best deal: ${name(top)}**, ${discountPct(top)}% off (${inr(top.price)}, was ${inr(top.mrp)}).`; break;
    default: {
      const fact = extra ? whyFor(top, extra) : null;
      why = fact ? `**My pick: ${name(top)}**\n${fact}` : `**My pick: ${name(top)}**, because ${reviewReason(top, pool.slice(1))}.`;
    }
  }
  const ORDER: Record<string, string> = { price_asc: "cheapest first", price_desc: "most premium first", light: "lightest first", heavy: "sturdiest first", thick: "thickest first", discount: "biggest discounts first", new: "newest first", best: "best rated first" };
  const order = sort ? ORDER[sort] : extra ? "best match first" : "best rated first";
  let kidNote = "";
  if (kidAge !== null && kidAge < 14) {
    kidNote = cats.includes("Footballs") || /football/.test(lower)
      ? `\n\n> 👶 **Tip:** for a ${kidAge}-year-old a size 4 ball is usually recommended (size 5 is for ages 12+). Our balls are size 5, which works well if they play with older kids.`
      : `\n\n> 👶 **Note:** our catalogue is mostly adult sizes, so check the size chart on the product page.`;
  }

  return {
    text:
      `**${pool.length} ${pool.length === 1 ? what.replace(/s$/, "") : what}${forWhom}${budget}**${pool.length > 1 ? `, ${order}` : ""} 👇\n\n` +
      `${productRows(shown, extraInfo)}${pool.length > shown.length ? `\n\n_+${pool.length - shown.length} more in the cards below_` : ""}\n\n> 💡 ${why}${kidNote}`,
    products: lite(pool.slice(0, 8)),
    suggestions:
      pool.length > 1
        ? [`Compare ${name(pool[0])} vs ${name(pool[1])}`, `Tell me more about ${name(top)}`, sort === "price_asc" ? "Show the best rated" : "Show cheaper options"]
        : [`Tell me more about ${name(top)}`, `Add ${name(top)} to cart`],
  };
}

function summary(p: Product): Reply {
  const benefits = p.benefits.slice(0, 3).map((b) => `- **${b.name}:** ${b.value}`).join("\n");
  const facts = [
    ...["Level of practice", "Fit", "Main material", "Waterproof"].filter((n) => spec(p, n)).map((n) => `- **${n}:** ${spec(p, n)}`),
    ...(p.sizes.length > 1 ? [`- **Sizes:** ${p.sizes.join(" · ")}`] : []),
    ...(p.weightKg ? [`- **Weight:** about ${p.weightKg} kg`] : []),
    `- **Warranty:** ${p.warrantyYears ?? 1} years · 30-day returns`,
  ].join("\n");
  return {
    text:
      `**${name(p)}** · ${p.brand}\n${inr(p.price)}${p.mrp > p.price ? ` ~~${inr(p.mrp)}~~ (${discountPct(p)}% off)` : ""} · ${ratingText(p)}\n\n` +
      `${p.madeFor || p.description}\n\n` +
      (benefits ? `**Why people like it**\n${benefits}\n\n` : "") +
      `**Quick facts**\n${facts}`,
    products: lite([p]),
    suggestions: [`Add ${name(p)} to cart`, "Is it good for beginners?", "Compare with similar"],
  };
}

function answerAboutProduct(p: Product, msg: string, lower: string): Reply {
  const n = name(p);
  const done = (text: string, extra: string[] = []): Reply => ({
    text,
    products: lite([p]),
    suggestions: [...extra, `Add ${n} to cart`, "Compare with similar"].slice(0, 3),
  });

  if (RE.price.test(lower) || RE.sale.test(lower))
    return done(`**${n}** costs **${inr(p.price)}**${p.mrp > p.price ? ` (was ~~${inr(p.mrp)}~~, ${discountPct(p)}% off)` : ""}.${p.offers.length ? `\n\n> 🏷️ **Offers:** ${p.offers.join(" · ")}` : ""}`, ["What sizes are available?"]);
  if (RE.sizes.test(lower))
    return done(p.sizes.length > 1 ? `**${n}** sizes\n\n- **Available:** ${p.sizes.join(" · ")}${spec(p, "Fit") ? `\n- **Fit:** ${spec(p, "Fit")}` : ""}\n\n> 📏 Between sizes? Tap **View Size Chart** on the product page.` : `**${n}** comes in one size${p.sizes[0] && !/one size/i.test(p.sizes[0]) ? ` (${p.sizes[0]})` : ""}.`, ["What is it made of?"]);
  if (RE.warranty.test(lower) || RE.returns.test(lower))
    return done(`**${n}**\n\n- **Warranty:** ${p.warrantyYears ?? 1} years\n- **Returns & exchange:** 30 days`);
  if (RE.reviews.test(lower))
    return done(p.reviewCount ? `**${n}** is rated **★ ${p.rating}/5** from ${p.reviewCount.toLocaleString("en-IN")} reviews, and ${p.recommendedCount.toLocaleString("en-IN")} buyers recommend it.` : `**${n}** is new and doesn't have reviews yet.`);
  if (RE.material.test(lower)) {
    const mat = [...p.materialAndCare.map((m) => `${m.name}: ${m.value}`), ...p.specifications.filter((s) => /material/i.test(s.name)).map((s) => `${s.name}: ${s.value}`)];
    if (mat.length) return done(`**${n}**: materials\n\n${mat.map((m) => `- ${m.replace(/^([^:]+):/, "**$1:**")}`).join("\n")}`);
  }
  if (RE.weight.test(lower) && p.weightKg) return done(`**${n}** weighs about **${p.weightKg} kg**${p.category === "Running Shoes" ? " (shipping weight of the pair, box included)" : ""}.`);
  if (RE.beginner.test(lower)) {
    const level = spec(p, "Level of practice");
    const s = beginnerScore(p);
    return done(`${s >= 3 ? "✅ **Yes, it's a good pick for beginners.**" : "**It can work for beginners**, though it isn't made specifically for them."}${level ? `\n\n- **Level of practice:** ${level}` : ""}\n\n${p.madeFor}`.trim());
  }

  // Any attribute: find the spec / benefit whose name or value matches the question ("pockets", "waterproof", "drop")
  const qt = tokenize(msg);
  const attrs = [...p.specifications, ...p.benefits, ...p.technicalInformation.filter((t) => t.value.length < 200)];
  const match = attrs.filter((a) => tokenize(`${a.name}`).some((t) => qt.includes(t)));
  if (match.length) return done(`**${n}**\n\n${match.slice(0, 3).map((a) => `- **${a.name}:** ${a.value}`).join("\n")}`);

  const hits = retrieve(msg, { productIds: [p.id], k: 3 }).filter((h) => h.chunk.kind !== "overview" && h.score > 1.5);
  if (hits.length) return done(`**About the ${n}**\n\n` + hits.slice(0, 2).map((h) => `- ${h.chunk.text.length > 220 ? h.chunk.text.slice(0, 217) + "…" : h.chunk.text}`).join("\n"));
  return done(`I don't have that detail for the **${n}**.\n\nHere's what I do know: ${p.madeFor || p.description}`, ["What sizes are available?", "What is it made of?"]);
}

function compare(pool: Product[], tokens: string[], lower: string, cats: string[]): Reply {
  let ps = [...pool];
  if (ps.length < 2) {
    let candidates = cats.length ? products.filter((p) => cats.includes(p.category)) : ps.length ? products.filter((p) => p.category === ps[0].category) : [];
    candidates = candidates.filter((p) => !ps.includes(p));
    const beginner = tokens.includes("beginners");
    ps = [...ps, ...(beginner ? [...candidates].sort((a, b) => beginnerScore(b) - beginnerScore(a)) : sortBy(candidates, "best"))].slice(0, 2);
  }
  if (ps.length < 2)
    return { text: "Which two products should I compare? Name them (e.g. \"Kipride Max vs Kipcore Premium\"), paste links, or say \"compare 2 yoga mats for beginners\".", suggestions: ["Compare Kipride Max vs Kipcore Premium", "Compare 2 yoga mats for beginners", "Compare BR 100 vs BR Lite 900"] };
  // "compare the top 2", "compare these three": respect the number asked for (2 or 3 columns fit on a phone)
  const asked = lower.match(/\b(2|3|two|three)\b/)?.[1];
  ps = ps.slice(0, asked === "2" || asked === "two" ? 2 : 3);

  const specNames = [...new Set(ps.flatMap((p) => p.specifications.map((s) => s.name)))]
    .filter((n) => ps.filter((p) => spec(p, n)).length >= 2 && new Set(ps.map((p) => spec(p, n) ?? "—")).size > 1)
    .slice(0, 7);
  const rows = [
    { label: "Price", values: ps.map((p) => inr(p.price)) },
    { label: "Rating", values: ps.map(ratingText) },
    ...(ps.some((p) => p.weightKg) ? [{ label: "Weight", values: ps.map((p) => (p.weightKg ? `${p.weightKg} kg` : "—")) }] : []),
    { label: "Material", values: ps.map((p) => p.materialAndCare[0]?.value ?? spec(p, "Main material") ?? "—") },
    ...specNames.map((n) => ({ label: n, values: ps.map((p) => spec(p, n) ?? "—") })),
    { label: "Warranty", values: ps.map((p) => `${p.warrantyYears ?? 1} yr`) },
  ];

  const need = tokens.includes("beginners") ? "beginner" : detectSort(lower);
  const winner =
    need === "beginner" ? [...ps].sort((a, b) => beginnerScore(b) - beginnerScore(a))[0]
    : need === "price_asc" ? sortBy(ps, "price_asc")[0]
    : need === "light" ? sortBy(ps, "light")[0]
    : sortBy(ps, "best")[0];
  const other = ps.find((p) => p !== winner)!;
  const cheaper = sortBy(ps, "price_asc")[0];

  const diffs: string[] = [];
  if (winner.price !== other.price) diffs.push(`**Price:** ${name(cheaper)} is ${inr(Math.abs(winner.price - other.price))} cheaper`);
  if (winner.weightKg && other.weightKg && Math.abs(winner.weightKg - other.weightKg) >= 0.1)
    diffs.push(`**Weight:** ${name(winner.weightKg < other.weightKg ? winner : other)} is lighter (${Math.min(winner.weightKg, other.weightKg)} vs ${Math.max(winner.weightKg, other.weightKg)} kg)`);
  for (const n of specNames.slice(0, 2)) diffs.push(`**${n}:** ${ps.map((p) => `${name(p)} ${spec(p, n) ?? "—"}`).join(" · ")}`);

  const reason =
    need === "beginner" ? `it's made for "${spec(winner, "Level of practice") ?? "all levels"}"`
    : need === "price_asc" ? `it's the cheaper option at ${inr(winner.price)}`
    : need === "light" ? `it's the lighter one`
    : reviewReason(winner, ps.filter((p) => p !== winner));

  return {
    text:
      `**${ps.map(name).join(" vs ")}**\n\n` +
      `> 🏆 **${need === "beginner" ? "For a beginner" : "My pick"}: ${name(winner)}**, because ${reason}.` +
      `${diffs.length ? `\n\n**Key differences**\n${diffs.map((d) => `- ${d}`).join("\n")}` : ""}\n\n_Full side-by-side below_ 👇`,
    compare: { rows, products: lite(ps) },
    products: lite(ps),
    suggestions: [`Add ${name(winner)} to cart`, `Tell me more about ${name(winner)}`, `Tell me more about ${name(other)}`],
  };
}

function pickFrom(ps: Product[], lower: string): Reply {
  const key = RE.beginner.test(lower) ? "beginner" : detectSort(lower) ?? "best";
  const p = key === "beginner" ? [...ps].sort((a, b) => beginnerScore(b) - beginnerScore(a))[0] : sortBy(ps, key)[0];
  const why =
    key === "beginner" ? `it's made for "${spec(p, "Level of practice") ?? "all levels"}"`
    : key === "price_asc" ? `it's the cheapest at ${inr(p.price)}`
    : key === "price_desc" ? `it's the premium option at ${inr(p.price)}`
    : key === "light" ? `it's the lightest${p.weightKg ? ` (about ${p.weightKg} kg)` : ""}`
    : key === "discount" ? `it has the biggest discount (${discountPct(p)}% off)`
    : reviewReason(p, ps.filter((x) => x !== p));
  return { text: `> 💡 Of those, I'd go with **${name(p)}**: ${why}.`, products: lite([p]), suggestions: [`Tell me more about ${name(p)}`, `Add ${name(p)} to cart`] };
}

function fallback(msg: string, lower: string): Reply {
  const ranked = rankProducts(msg).filter((r) => r.score > 4).slice(0, 4);
  if (ranked.length && !/\b(weather|news|joke|time|date|who are you|your name)\b/.test(lower)) {
    const ps = ranked.map((r) => getProduct(r.id)!);
    const why = whyFor(ps[0], msg);
    return { text: `**These look relevant** 👇\n\n${productRows(ps)}${why ? `\n\n> 💡 **${name(ps[0])}**: ${why}` : ""}`, products: lite(ps), suggestions: [`Tell me more about ${name(ps[0])}`] };
  }
  if (/\b(who are you|your name|what can you do|help)\b/.test(lower)) return greet();
  return {
    text: "I'm here to help with sports gear, so I can't answer that one 🙂\n\nI can:\n- find products by sport, budget or need\n- explain features and sizes\n- compare items\n- add them to your cart",
    suggestions: ["Show me running shoes", "Best trekking backpack", "What's on sale?"],
  };
}
