/**
 * Plain-language explanations for technical words on product pages.
 * These are general definitions of the term, not claims about a specific product.
 */
export type Entry = { title: string; plain: string };

const ENTRIES: { terms: string[]; entry: Entry }[] = [
  { terms: ["polyamide", "nylon"], entry: { title: "Polyamide (nylon)", plain: "A strong, light synthetic fabric that dries fast and resists wear. Common in sportswear and bags." } },
  { terms: ["polyester"], entry: { title: "Polyester", plain: "A durable synthetic fabric that dries quickly and keeps its shape. It moves sweat away from your skin." } },
  { terms: ["elastane", "spandex", "lycra"], entry: { title: "Elastane", plain: "The stretchy fibre blended into fabric so it stretches and springs back. More elastane means more stretch." } },
  { terms: ["cotton"], entry: { title: "Cotton", plain: "A soft natural fibre that feels comfortable on skin but dries slowly when it gets wet." } },
  { terms: ["lyocell"], entry: { title: "Lyocell", plain: "A smooth, breathable fabric made from wood pulp. Gentle on skin." } },
  { terms: ["polyurethane"], entry: { title: "Polyurethane", plain: "A flexible, hard-wearing material used in foams and coatings." } },
  { terms: ["tpu"], entry: { title: "TPU", plain: "A tough, flexible plastic used for coatings and shoe parts. It resists wear and water." } },
  { terms: ["pvc"], entry: { title: "PVC", plain: "A hard-wearing, waterproof plastic coating. Heavier than fabric." } },
  { terms: ["high modulus graphite"], entry: { title: "High modulus graphite", plain: "A very stiff, very light carbon-based material. \"High modulus\" means extra stiff for its weight." } },
  { terms: ["seamless"], entry: { title: "Seamless", plain: "Knitted in one piece with few or no stitched seams, so there is less rubbing on your skin." } },
  { terms: ["cushioning"], entry: { title: "Cushioning", plain: "Soft padding in a shoe's sole that absorbs the impact when your foot lands." } },
  { terms: ["energy return"], entry: { title: "Energy return", plain: "How much of the force you push into the sole comes back as spring in your next step." } },
  { terms: ["moisture management", "wicking"], entry: { title: "Moisture management", plain: "Fabric that pulls sweat away from your skin so it evaporates quickly and you stay dry." } },
  { terms: ["chafing"], entry: { title: "Chafing", plain: "Skin irritation from rubbing. \"Reduced chafing\" usually means flatter seams and smoother fabric." } },
  { terms: ["breathability", "breathable"], entry: { title: "Breathability", plain: "How easily air and sweat vapour pass through the fabric. More breathable feels cooler." } },
  { terms: ["ventilation"], entry: { title: "Ventilation", plain: "Mesh panels or openings that let air flow through so you don't overheat." } },
  { terms: ["waterproof"], entry: { title: "Waterproof", plain: "Keeps water out. Stitched seams can still let some through unless they are sealed." } },
  { terms: ["windproof"], entry: { title: "Windproof", plain: "Blocks wind so you stay warmer." } },
  { terms: ["4-way stretch", "four-way stretch"], entry: { title: "4-way stretch", plain: "The fabric stretches both across and lengthways, so it moves with you in every direction." } },
  { terms: ["dwr"], entry: { title: "DWR coating", plain: "A thin water-repellent finish that makes rain bead up and roll off. It is not fully waterproof and wears off over time." } },
  { terms: ["sphericity"], entry: { title: "Sphericity", plain: "How perfectly round a ball is. Higher sphericity gives a truer, more predictable bounce." } },
  { terms: ["bladder"], entry: { title: "Bladder", plain: "The inner air-holding layer of a ball, or the water bag inside a hydration pack." } },
  { terms: ["suspension"], entry: { title: "Suspension", plain: "Springs or shocks that soften bumps on a bike. \"None\" means a rigid frame that is lighter but harsher." } },
  { terms: ["microshift"], entry: { title: "Microshift", plain: "A maker of bicycle gear-shifting parts, the components that change gears." } },
  { terms: ["forgiveness"], entry: { title: "Forgiveness", plain: "In rackets, how well a shot that misses the sweet spot still goes where you meant it to." } },
  { terms: ["l29"], entry: { title: "L29", plain: "Leg length (inseam) of 29 inches, about 74 cm." } },
];

const LOOKUP = new Map<string, Entry>();
for (const { terms, entry } of ENTRIES) for (const t of terms) LOOKUP.set(t.toLowerCase(), entry);

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const PATTERN = new RegExp(`\\b(${[...LOOKUP.keys()].sort((a, b) => b.length - a.length).map(esc).join("|")})\\b`, "gi");

export type Piece = { text: string; entry?: Entry };

/** Splits text into plain pieces and pieces that name a glossary term. */
export function splitJargon(text: string): Piece[] {
  const out: Piece[] = [];
  let last = 0;
  for (const m of text.matchAll(PATTERN)) {
    const at = m.index ?? 0;
    if (at > last) out.push({ text: text.slice(last, at) });
    out.push({ text: m[0], entry: LOOKUP.get(m[0].toLowerCase()) });
    last = at + m[0].length;
  }
  if (last < text.length) out.push({ text: text.slice(last) });
  return out;
}
