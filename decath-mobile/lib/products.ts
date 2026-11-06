import raw from "@/data/products.json";
import type { Product, ProductLite } from "./types";

export const products = raw as Product[];

export const CATEGORIES = [
  { slug: "running-shoes", name: "Running Shoes" },
  { slug: "yoga-pants", name: "Yoga Pants" },
  { slug: "backpacks", name: "Backpacks" },
  { slug: "footballs", name: "Footballs" },
  { slug: "yoga-mats", name: "Yoga Mats" },
  { slug: "badminton", name: "Badminton" },
  { slug: "cycles", name: "Cycles" },
  { slug: "t-shirts", name: "T-Shirts" },
] as const;

export const categoryBySlug = (slug: string) => CATEGORIES.find((c) => c.slug === slug);
export const slugForCategory = (name: string) =>
  CATEGORIES.find((c) => c.name === name)?.slug ?? "all";

export const getProduct = (id: string) => products.find((p) => p.id === id);

export const productsInCategory = (name: string) => products.filter((p) => p.category === name);

export function similarProducts(p: Product, n = 6) {
  return products.filter((x) => x.id !== p.id && x.category === p.category).slice(0, n);
}

/** Products from other categories that share the same sport (e.g. yoga pants -> yoga mats). */
export function boughtTogether(p: Product, n = 6) {
  const same = products.filter((x) => x.id !== p.id && x.sport === p.sport && x.category !== p.category);
  const rest = products.filter((x) => x.id !== p.id && x.category !== p.category && !same.includes(x));
  return [...same, ...rest].slice(0, n);
}

export function searchProducts(q: string) {
  const terms = q.toLowerCase().split(/\s+/).filter(Boolean);
  if (!terms.length) return products;
  return products
    .map((p) => {
      const hay = `${p.name} ${p.brand} ${p.category} ${p.sport} ${p.gender} ${p.breadcrumbs.join(" ")}`.toLowerCase();
      const score = terms.reduce((s, t) => s + (hay.includes(t) ? 1 : 0) + (hay.includes(t.replace(/s$/, "")) ? 0.5 : 0), 0);
      return { p, score };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((x) => x.p);
}

export const inr = (n: number) => "₹" + n.toLocaleString("en-IN");
export const discountPct = (p: Pick<Product, "price" | "mrp">) =>
  p.mrp > p.price ? Math.round(((p.mrp - p.price) / p.mrp) * 100) : 0;

/** Decathlon's CDN resizes on the fly with ?f=WxH */
export const img = (url: string, size = 600) => `${url}?format=auto&f=${size}x${size}`;

/** "Women's ... Pants - Black" -> "Black" */
export function colourOf(p: Product) {
  const m = p.name.match(/[-–]\s*([A-Za-z ]+)$/);
  return m ? m[1].trim() : null;
}

export const toLite = (p: Product): ProductLite => ({
  id: p.id,
  name: p.name,
  shortName: p.shortName,
  brand: p.brand,
  price: p.price,
  mrp: p.mrp,
  rating: p.rating,
  reviewCount: p.reviewCount,
  category: p.category,
  tag: p.tag,
  image: p.images[0],
});

// ---------- demo reviews (real averages/counts, generated text) ----------

function rng(seed: string) {
  let h = 2166136261;
  for (const c of seed) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return ((h ^= h >>> 16) >>> 0) / 4294967296;
  };
}

/** Star distribution [5,4,3,2,1] that roughly matches the real average and count. */
export function ratingBreakdown(p: Product): number[] {
  const n = p.reviewCount;
  if (!n) return [0, 0, 0, 0, 0];
  const r = p.rating;
  const w5 = Math.max(0.05, (r - 3) / 2) ** 1.4;
  const weights = [w5, (1 - w5) * 0.45, (1 - w5) * 0.15, (1 - w5) * 0.1, (1 - w5) * 0.3];
  const sum = weights.reduce((a, b) => a + b, 0);
  const counts = weights.map((w) => Math.round((w / sum) * n));
  counts[0] += n - counts.reduce((a, b) => a + b, 0);
  return counts;
}

const NAMES = ["Vinoth Kumar", "Divya", "Sahil", "Ananya R", "Rohit M", "Priya S", "Karthik", "Meera", "Aditya", "Neha P"];
const TEXTS: Record<string, string[]> = {
  "Running Shoes": ["Very comfortable for long runs, great cushioning.", "Good grip and fits true to size.", "Light and breathable, my knees feel better.", "Slightly narrow toe box but great overall."],
  "Yoga Pants": ["The fit is so good and the fabric is quite stretchable and airy", "Good product and doesn't hurt the stomach line", "Soft fabric, perfect for daily yoga.", "Good one"],
  Backpacks: ["Carried it on a 4 day trek, very comfortable.", "Lots of space and the back padding is great.", "Value for money, sturdy zips."],
  Footballs: ["Holds shape well even on rough ground.", "Good bounce and touch.", "Great ball for the price."],
  "Yoga Mats": ["Good grip, doesn't slip even when sweaty.", "Thick and comfortable on knees.", "Light and easy to carry."],
  Badminton: ["Great for beginners.", "Light racket, good control.", "Perfect for family games."],
  Cycles: ["Smooth gear shifting, easy assembly.", "Great for daily commute.", "Solid build and comfortable ride."],
  "T-Shirts": ["Dries quickly, great for gym.", "Fits well, fabric is soft.", "Good quality for the price."],
};

export function demoReviews(p: Product, count = 4) {
  if (!p.reviewCount) return [];
  const rand = rng(p.id);
  const texts = TEXTS[p.category] ?? ["Good product"];
  return Array.from({ length: Math.min(count, p.reviewCount) }, (_, i) => ({
    stars: rand() < p.rating / 5.2 ? 5 : 4,
    text: texts[i % texts.length],
    name: NAMES[Math.floor(rand() * NAMES.length)],
    daysAgo: 3 + i + Math.floor(rand() * 3),
  }));
}

export function aspectScores(p: Product) {
  const names = p.benefits.slice(0, 4).map((b) => b.name);
  while (names.length < 4) names.push(["Look / Design", "Value for money", "Comfort", "Durability"][names.length]);
  const base = Math.max(3, Math.round(p.rating || 4));
  return names.map((name, i) => ({ name, score: Math.min(5, base - (i === 2 && base > 4 ? 1 : 0)) }));
}

export const toCard = (p: Product) => ({ ...toLite(p), offers: p.offers, sizes: p.sizes });
