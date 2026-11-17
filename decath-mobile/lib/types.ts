export type KV = { name: string; value: string };

export type Product = {
  id: string;
  slug: string;
  name: string;
  shortName: string;
  brand: string;
  category: string;
  sport: string;
  gender: string;
  price: number;
  mrp: number;
  rating: number;
  reviewCount: number;
  recommendedCount: number;
  images: string[];
  description: string;
  madeFor: string;
  warrantyYears: number | null;
  madeIn: string;
  sizes: string[];
  weightKg: number | null;
  inStock: boolean;
  tag: string | null;
  offers: string[];
  benefits: KV[];
  technicalInformation: KV[];
  specifications: KV[];
  materialAndCare: KV[];
  breadcrumbs: string[];
  sourceUrl: string;
};

export type CartItem = { id: string; size: string | null; qty: number };

/** Compact product shape returned by the chat API. */
export type ProductLite = Pick<
  Product,
  "id" | "name" | "shortName" | "brand" | "price" | "mrp" | "rating" | "reviewCount" | "category" | "tag"
> & { image: string };

/** A passage an answer is based on, shown as a numbered source under the reply */
export type Source = { n: number; id: string; title: string; kind: "policy" | "guide" | "product"; url: string; snippet: string };

/** How an answer was found: the rewritten query and what each retrieval stage produced */
export type RagTrace = {
  query: string;
  rewritten: string;
  notes: string[];
  stages: string[];
  top: { id: string; title: string; bm25: number; ngram: number; fused: number; score: number }[];
  confident: boolean;
};

export type ChatMessage = {
  role: "user" | "assistant";
  text: string;
  products?: ProductLite[];
  compare?: { rows: { label: string; values: string[] }[]; products: ProductLite[] };
  suggestions?: string[];
  /** a visual-cards question from the shopping advisor (criterion id) */
  cards?: string;
  /** numbered passages the reply is based on, cited in the text as [1], [2] */
  sources?: Source[];
  /** how the answer was found (rewritten query, retrieval stages and scores) */
  trace?: RagTrace;
  /** Something the app should do for the shopper (e.g. add an item to the cart) */
  action?: { type: "add_to_cart"; productId: string; size: string | null };
  time: number;
};
