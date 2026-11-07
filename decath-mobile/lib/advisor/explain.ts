/**
 * Explanations, generated only from the engine's computed reasons and catalogue facts.
 * Nothing here claims comfort, fit, material or performance unless the catalogue field says so.
 */
import { inr } from "@/lib/products";
import type { Product } from "@/lib/types";
import { NOT_SPECIFIED, profileOf, type Brief, type Check, type Eval, type Result } from "./engine";
import { asList, criterion, optionLabel, specOf, type Evidence } from "./profiles";

const plural = (p: Product) => /(pants|trousers|trackpants|shoes|leggings)$/i.test(p.shortName);
const verb = (p: Product, one: string, many: string) => (plural(p) ? many : one);
const they = (p: Product) => (plural(p) ? "They" : "It");
export const nm = (p: Product) => p.shortName;
export const ranksVerb = (p: Product) => verb(p, "ranks", "rank");
/** lower-case a label for mid-sentence use, but keep "60 L+" as written */
const lc = (s: string) => (/\d/.test(s) ? s : s.toLowerCase());
const lcPhrase = (s: string) => s.replace(/\b([A-Z])([a-z])/g, (m, a, b) => a.toLowerCase() + b);
const reviews = (p: Product) => (p.reviewCount ? `★ ${p.rating} from ${p.reviewCount.toLocaleString("en-IN")} reviews` : "No reviews yet");

/** "flared", "fitted leggings": the pant type as used in a sentence */
const TYPE_TAG: Record<string, string> = { "Fitted leggings": "fitted leggings", "Flared yoga pants": "flared", "Relaxed or straight-fit pants": "relaxed or straight-fit", "Yoga capris": "capri" };
const typeTags = (wanted: string) => wanted.split(" or ").map((w) => TYPE_TAG[w] ?? w.toLowerCase()).join(" or ");
function prefPhrase(c: Check) {
  if (c.id === "type") return `preferred ${typeTags(c.wanted)} style`;
  if (c.id === "pockets") return "requested pockets";
  return c.id === "level" ? `listed for ${c.listed.toLowerCase()}` : `${c.label.toLowerCase()} preference (${lc(c.wanted)})`;
}
const blockerText = (c: Check) =>
  c.id === "budget" ? "Above your budget" : c.id === "stock" ? "Currently unavailable" : c.status === "unknown" ? `${c.label} not specified (must-have)` : `Doesn't meet your ${c.label.toLowerCase()} must-have`;

// ------------------------------------------------------------------ labels for a comparison column

export function labelsFor(e: Eval, r: Result, brief: Brief): { text: string; tone: "good" | "bad" | "info" }[] {
  const out: { text: string; tone: "good" | "bad" | "info" }[] = [];
  for (const b of e.blockers) out.push({ text: blockerText(b), tone: "bad" });
  if (e.budget?.status === "match") out.push({ text: "Within your budget", tone: "good" });
  const sel = r.selected;
  if (sel.length > 1 && sel.every((o) => o === e || o.p.price > e.p.price)) out.push({ text: "Lowest price among these options", tone: "info" });
  for (const c of e.checks) {
    if (c.must && c.status !== "match") continue; // already a blocker
    if (c.id === "level") {
      if (c.status === "match") out.push({ text: `Listed for ${c.listed.toLowerCase()}`, tone: "good" });
      else if (c.status === "mismatch") out.push({ text: `Listed for ${c.listed.toLowerCase()} only`, tone: "bad" });
      continue;
    }
    if (c.id === "type") {
      out.push(c.status === "match" ? { text: `Matches your preferred ${typeTags(c.wanted)} style`, tone: "good" } : c.status === "mismatch" ? { text: `Not your preferred style`, tone: "bad" } : { text: "Pant type not clear from listing", tone: "info" });
      continue;
    }
    if (c.id === "pockets") {
      out.push(c.status === "match" ? { text: "Includes your requested pockets", tone: "good" } : c.status === "mismatch" ? { text: "No pockets listed", tone: "bad" } : { text: "Pocket information not specified", tone: "info" });
      continue;
    }
    const crit = criterion(profileOf(brief), c.id);
    out.push(
      c.status === "match" ? { text: `Matches your ${c.label.toLowerCase()} preference`, tone: "good" }
      : c.status === "mismatch" ? { text: `Doesn't match your ${c.label.toLowerCase()} preference`, tone: "bad" }
      : { text: crit?.benefitBased ? `${c.wanted} not listed as a benefit` : c.id === "waist" ? "Waist-rise information not specified" : `${c.label} information not specified`, tone: "info" },
    );
  }
  if (["yoga-pants"].includes(brief.profile) && !specOf(e.p, "Fit")) out.push({ text: "Fit information unavailable", tone: "info" });
  return out;
}

// ------------------------------------------------------------------ the recommendation card

export type Recommendation = {
  title: string;
  headline: string;
  why: string[];
  giveUp: string[];
  check: string[];
  evidence: { product: Product; items: Evidence[] }[];
};

function whyFits(e: Eval, brief: Brief): string[] {
  const out: string[] = [];
  if (e.budget) out.push(`Within your ${inr(brief.budget!)} budget at ${inr(e.p.price)}`);
  for (const c of e.checks) {
    if (c.status !== "match") continue;
    out.push(c.id === "level" ? `Listed for ${c.listed.toLowerCase()} (Level of practice)` : c.id === "type" ? `Matches your preferred ${typeTags(c.wanted)} style: ${c.listed}` : c.id === "pockets" ? `Includes your requested pockets: ${c.listed}` : `Matches your ${c.label.toLowerCase()} preference: ${c.listed}`);
  }
  return out;
}

function ownMismatches(e: Eval): string[] {
  return e.checks
    .filter((c) => c.status === "mismatch")
    .map((c) => (c.id === "level" ? `Listed for ${c.listed.toLowerCase()}, not ${c.wanted.toLowerCase()} level` : c.id === "type" ? `Not your preferred ${typeTags(c.wanted)} style` : `Doesn't match your ${c.label.toLowerCase()} preference (${lc(c.wanted)}): listed as ${c.listed}`));
}

function tradeOffs(e: Eval, vs: Eval, brief: Brief): string[] {
  const out: string[] = [];
  if (e.p.price > vs.p.price) out.push(`Costs ${inr(e.p.price - vs.p.price)} more than the ${nm(vs.p)}`);
  for (const c of e.checks) {
    const o = vs.checks.find((x) => x.id === c.id);
    if (o?.status === "match" && c.status !== "match" && c.id === "type")
      out.push(`Not your preferred ${typeTags(c.wanted)} style, which the ${nm(vs.p)} ${verb(vs.p, "is", "are")}`);
    else if (o?.status === "match" && c.status !== "match")
      out.push(c.status === "unknown" ? `${c.label} isn't specified, while the ${nm(vs.p)} ${verb(vs.p, "matches", "match")} your preference` : `${c.label}: ${c.listed}, where the ${nm(vs.p)} ${verb(vs.p, "matches", "match")} your preference (${o.listed})`);
  }
  if (vs.p.reviewCount && e.p.reviewCount && vs.p.rating > e.p.rating) out.push(`The ${nm(vs.p)} has a higher rating (${reviews(vs.p)} vs ${reviews(e.p)})`);
  if (profileOf(brief).showWeight && e.p.weightKg && vs.p.weightKg && e.p.weightKg - vs.p.weightKg >= 0.05)
    out.push(`Heavier: ${e.p.weightKg} kg vs ${vs.p.weightKg} kg listed`);
  return out;
}

function stillCheck(e: Eval, brief: Brief): string[] {
  const out: string[] = [];
  const profile = profileOf(brief);
  for (const c of e.checks) if (c.status === "unknown") out.push(`${c.label}: not specified in the catalogue`);
  for (const c of profile.criteria)
    if (!c.informational && c.classify && !asList(brief.values[c.id]).length && c.question && !c.refine && c.classify(e.p) === null && c.id !== "level")
      out.push(`${c.label}: not specified for this product`);
  if (e.p.sizes.length > 1) {
    const fit = specOf(e.p, "Fit");
    out.push(`Your size (${e.p.sizes.join(", ")}). ${fit ? `Fit is listed as "${fit}"; check the size chart.` : "Fit information unavailable; check the size chart."} Per-size stock isn't shown in this demo.`);
  }
  return out;
}

export function evidenceFor(e: Eval): Evidence[] {
  const items: Evidence[] = [
    { source: "Price", field: "Current price", value: `${inr(e.p.price)}${e.p.mrp > e.p.price ? ` (MRP ${inr(e.p.mrp)})` : ""}` },
    { source: "Reviews", field: "Rating", value: reviews(e.p) },
  ];
  for (const c of e.checks) items.push(c.evidence ?? { source: "Specifications", field: c.label, value: NOT_SPECIFIED });
  if (e.p.sizes.length) items.push({ source: "Sizes", field: "Sizes listed", value: e.p.sizes.join(", ") });
  if (e.p.weightKg) items.push({ source: "Weight", field: "Listed weight", value: `${e.p.weightKg} kg` });
  return items;
}

export function recommend(r: Result, brief: Brief): Recommendation {
  const v = r.verdict;
  if (v.kind === "none")
    return { title: "No match yet", headline: v.conflict.text, why: [], giveUp: [], check: [], evidence: [] };
  if (v.kind === "only") {
    const others = r.selected.filter((e) => e !== v.top);
    return {
      title: `Recommended: ${nm(v.top.p)}`,
      headline: `${others.length ? `Only the ${nm(v.top.p)} meets your must-haves among these.` : `The ${nm(v.top.p)} is the only option that meets your must-haves.`}${others[0]?.blockers[0] ? ` The ${nm(others[0].p)}: ${blockerText(others[0].blockers[0]).toLowerCase()}.` : ""}`,
      why: whyFits(v.top, brief),
      giveUp: others.length ? tradeOffs(v.top, others[0], brief) : [],
      check: stillCheck(v.top, brief),
      evidence: [v.top, ...others].map((e) => ({ product: e.p, items: evidenceFor(e) })),
    };
  }
  if (v.kind === "tie") {
    const [a, b] = v.group;
    const cheaper = a.p.price <= b.p.price ? a : b, dearer = cheaper === a ? b : a;
    return {
      title: v.group.length === 2 ? "Both are suitable" : "No clear winner",
      headline:
        `${v.group.map((e) => `the ${nm(e.p)}`).join(" and ").replace(/^t/, "T")} fit your brief equally on what the catalogue lists.` +
        (dearer.p.price > cheaper.p.price ? ` The ${nm(cheaper.p)} costs ${inr(dearer.p.price - cheaper.p.price)} less.` : ""),
      why: v.group.flatMap((e) => whyFits(e, brief).slice(0, 2).map((w) => `${nm(e.p)}: ${w.charAt(0).toLowerCase()}${w.slice(1)}`)),
      giveUp: tradeOffs(dearer, cheaper, brief).map((t) => `${nm(dearer.p)}: ${t.charAt(0).toLowerCase()}${t.slice(1)}`),
      check: [...new Set(v.group.flatMap((e) => stillCheck(e, brief).filter((c) => !c.startsWith("Your size"))))].concat("Your size in the size chart before adding to cart"),
      evidence: v.group.map((e) => ({ product: e.p, items: evidenceFor(e) })),
    };
  }
  const { top, alt, reason } = v;
  let headline: string;
  const lost = top.checks.filter((c) => c.id !== "level" && c.status !== "match" && alt.checks.find((o) => o.id === c.id)?.status === "match");
  const lostText = lost.length ? ` ${they(top.p)} ${verb(top.p, "doesn't", "don't")} match your ${lost.map(prefPhrase).join(" or ")}.` : "";
  if (reason.kind === "price") {
    const lvl = top.checks.find((c) => c.id === "level" && c.status === "match");
    headline = `The ${nm(top.p)} ${verb(top.p, "costs", "cost")} ${inr(reason.diff)} less${lvl ? ` and ${verb(top.p, "is", "are")} listed for ${brief.values.level ?? "all"}-level practice` : ""}.` + lostText;
  } else if (reason.kind === "weight") {
    headline = `The ${nm(top.p)} ${verb(top.p, "is", "are")} the lighter option: ${top.p.weightKg} kg vs ${alt.p.weightKg ?? "unlisted"} kg listed.` + (top.p.price > alt.p.price ? ` ${they(top.p)} ${verb(top.p, "costs", "cost")} ${inr(top.p.price - alt.p.price)} more.` : "") + lostText;
  } else {
    const won = reason.won.filter((c) => c.id !== "level");
    headline =
      `The ${nm(top.p)} ${verb(top.p, "matches", "match")} your ${won.length ? won.map(prefPhrase).join(" and ") : "preferences"}${top.budget ? ` and ${verb(top.p, "stays", "stay")} within your ${inr(brief.budget!)} budget` : ""}.` +
      (top.p.price > alt.p.price ? ` ${they(top.p)} ${verb(top.p, "costs", "cost")} ${inr(top.p.price - alt.p.price)} more than the ${nm(alt.p)}.` : top.p.price < alt.p.price ? ` ${they(top.p)} also ${verb(top.p, "costs", "cost")} ${inr(alt.p.price - top.p.price)} less.` : "");
  }
  const lvlMiss = top.checks.find((c) => c.id === "level" && c.status === "mismatch");
  if (lvlMiss) headline += ` Note: ${they(top.p).toLowerCase() === "it" ? "it's" : "they're"} listed for ${lvlMiss.listed.toLowerCase()}, not ${lvlMiss.wanted.toLowerCase()} level.`;
  return {
    title: `Recommended: ${nm(top.p)}`,
    headline,
    why: whyFits(top, brief).concat(reason.kind === "price" ? [`Lowest price among the options compared (${inr(top.p.price)})`] : reason.kind === "weight" ? [`Lightest listed weight among the options compared (${top.p.weightKg} kg)`] : []),
    giveUp: [...new Set([...tradeOffs(top, alt, brief), ...ownMismatches(top)])],
    check: stillCheck(top, brief),
    evidence: [top, alt].map((e) => ({ product: e.p, items: evidenceFor(e) })),
  };
}

// ------------------------------------------------------------------ comparison rows

export type Row = { label: string; cells: { text: string; tone?: "good" | "bad" | "muted" }[] };

const tone = (s: Check["status"]) => (s === "match" ? "good" : s === "mismatch" ? "bad" : "muted") as "good" | "bad" | "muted";

export function needsRows(r: Result, brief: Brief): Row[] {
  const sel = r.selected;
  const minPrice = Math.min(...sel.map((e) => e.p.price));
  const rows: Row[] = [
    {
      label: "Price",
      cells: sel.map((e) => ({
        text: `${inr(e.p.price)}${brief.budget !== null ? (e.p.price <= brief.budget ? " · within budget" : ` · ${inr(e.p.price - brief.budget)} over`) : ""}${sel.length > 1 && e.p.price === minPrice ? " · lowest" : ""}`,
        tone: brief.budget !== null && e.p.price > brief.budget ? "bad" : undefined,
      })),
    },
    { label: "Rating", cells: sel.map((e) => ({ text: e.p.reviewCount ? `★ ${e.p.rating} (${e.p.reviewCount.toLocaleString("en-IN")})` : "No reviews yet" })) },
  ];
  const profile = profileOf(brief);
  for (const c of profile.criteria) {
    const v = brief.values[c.id];
    if (c.informational || !c.classify) continue;
    if (!asList(v).length) {
      // not part of the brief: show only if the products differ on it (it may still matter)
      const listed = sel.map((e) => c.fact?.(e.p)?.value ?? NOT_SPECIFIED);
      if (c.id !== "level" && new Set(listed).size > 1 && c.question && !c.cards) rows.push({ label: c.label, cells: listed.map((t) => ({ text: t, tone: t === NOT_SPECIFIED ? "muted" : undefined })) });
      continue;
    }
    rows.push({
      label: `${c.id === "level" ? "Level" : c.label}${brief.must[c.id] && c.canBeMust ? " (must)" : ""}`,
      cells: sel.map((e) => {
        const ch = e.checks.find((x) => x.id === c.id)!;
        return { text: `${ch.status === "match" ? "✓ " : ch.status === "mismatch" ? "✗ " : ""}${ch.listed}`, tone: tone(ch.status) };
      }),
    });
  }
  if (profile.showWeight) rows.push({ label: "Weight", cells: sel.map((e) => ({ text: e.p.weightKg ? `${e.p.weightKg} kg` : NOT_SPECIFIED, tone: e.p.weightKg ? undefined : "muted" })) });
  rows.push({
    label: "Not specified",
    cells: sel.map((e) => {
      const miss = profile.criteria.filter((c) => !c.informational && c.classify && c.classify(e.p) === null).map((c) => c.label);
      if (brief.profile === "yoga-pants" && !specOf(e.p, "Fit")) miss.push("Fit");
      return { text: miss.length ? miss.join(", ") : "—", tone: "muted" };
    }),
  });
  return rows;
}

export function allSpecRows(r: Result): Row[] {
  const sel = r.selected;
  const names = [...new Set(sel.flatMap((e) => e.p.specifications.map((s) => s.name)))].sort();
  return [
    { label: "Price", cells: sel.map((e) => ({ text: `${inr(e.p.price)}${e.p.mrp > e.p.price ? ` (MRP ${inr(e.p.mrp)})` : ""}` })) },
    { label: "Rating", cells: sel.map((e) => ({ text: e.p.reviewCount ? `★ ${e.p.rating} (${e.p.reviewCount.toLocaleString("en-IN")})` : "No reviews yet" })) },
    { label: "Sizes", cells: sel.map((e) => ({ text: e.p.sizes.length ? e.p.sizes.join(", ") : NOT_SPECIFIED, tone: e.p.sizes.length ? undefined : "muted" })) },
    { label: "Weight", cells: sel.map((e) => ({ text: e.p.weightKg ? `${e.p.weightKg} kg` : NOT_SPECIFIED, tone: e.p.weightKg ? undefined : "muted" })) },
    ...names.map((n) => ({
      label: n,
      cells: sel.map((e) => {
        const v = specOf(e.p, n);
        return { text: v ? v.replace(/,(?=\S)/g, ", ") : NOT_SPECIFIED, tone: v ? undefined : ("muted" as const) };
      }),
    })),
    { label: "Warranty", cells: sel.map((e) => ({ text: e.p.warrantyYears ? `${e.p.warrantyYears} years` : NOT_SPECIFIED, tone: e.p.warrantyYears ? undefined : "muted" })) },
  ];
}

// ------------------------------------------------------------------ what changed

type BriefLine = { key: string; label: string; hint?: string; value: string; kind: "must" | "pref" | "info" | null };
/** Only values the shopper supplied or confirmed (plus budget and priority); assumptions are labelled. */
export function briefLines(brief: Brief): BriefLine[] {
  const profile = profileOf(brief);
  const lines: BriefLine[] = [
    { key: "profile", label: "Activity", value: profile.noun.charAt(0).toUpperCase() + profile.noun.slice(1), kind: null },
  ];
  const hint = (k: string, c?: { role: string; label: string }) =>
    brief.sources[k] === "implied" ? "Set from trip duration" : brief.sources[k] === "saved" ? "Saved preference" : c?.role === "use" ? c.label : undefined;
  const ordered = [...profile.criteria].sort((a, b) => ["level", "use", "pref"].indexOf(a.role) - ["level", "use", "pref"].indexOf(b.role));
  for (const c of ordered) {
    if (c.role === "pref" || !(c.id in brief.values)) continue;
    lines.push({ key: c.id, label: c.role === "level" ? "Experience level" : "Intended use", hint: hint(c.id, c), value: optionLabel(c, brief.values[c.id]), kind: c.informational ? "info" : asList(brief.values[c.id]).length ? "pref" : null });
  }
  lines.push({ key: "budget", label: "Budget", value: brief.budget === null ? "No limit" : `Up to ${inr(brief.budget)}`, kind: brief.budget === null ? null : "must" });
  for (const c of ordered.filter((c) => c.role === "pref" && c.id in brief.values))
    lines.push({ key: c.id, label: c.label, hint: hint(c.id), value: optionLabel(c, brief.values[c.id]), kind: asList(brief.values[c.id]).length ? (brief.must[c.id] && c.canBeMust ? "must" : "pref") : null });
  if (brief.size) lines.push({ key: "size", label: "Size", value: brief.size, kind: null });
  lines.push({ key: "priority", label: "Priority", value: profile.priorities.find((p) => p.id === brief.priority)?.label ?? brief.priority, kind: null });
  return lines;
}

export function briefDiff(a: Brief, b: Brief): string[] {
  const la = briefLines(a), lb = briefLines(b);
  const out: string[] = [];
  for (const l of lb) {
    const o = la.find((x) => x.key === l.key && x.label === l.label);
    if (!o) { out.push(`${l.label}: ${l.value}`); continue; }
    if (o.value !== l.value) out.push(`${l.label}: ${o.value} → ${l.value}`);
    else if (o.kind !== l.kind && (o.kind === "must" || l.kind === "must")) out.push(`${l.label}: ${l.kind === "must" ? "now a must-have" : "now a preference"}`);
  }
  for (const o of la) if (!lb.some((l) => l.key === o.key) && a.profile === b.profile) out.push(`${o.label}: removed`);
  if (a.profile !== b.profile) return [`Activity: ${profileOf(a).noun} → ${profileOf(b).noun}`, ...out.filter((x) => !x.startsWith("Activity"))];
  return out;
}

const same = (x: unknown, y: unknown) => JSON.stringify(x ?? "∅") === JSON.stringify(y ?? "∅");

function causeOf(a: Brief, b: Brief): { text: string; key: string } {
  const profile = profileOf(b);
  if (a.priority !== b.priority)
    return { key: "priority", text: b.priority === "price" ? "You prioritised lower price" : b.priority === "weight" ? "You prioritised lower weight" : "You prioritised your preferences over price" };
  if (a.budget !== b.budget) return { key: "budget", text: b.budget === null ? "With no budget limit" : `With a ${inr(b.budget)} budget` };
  for (const c of profile.criteria) {
    if (!same(a.values[c.id], b.values[c.id])) {
      const v = b.values[c.id];
      return { key: c.id, text: asList(v).length ? `You prioritised ${lcPhrase(optionLabel(c, v))}${c.id === "coverage" || c.id === "length" ? " length" : c.role === "level" ? " level" : c.id === "fit" ? " fit" : c.id === "waist" || c.id === "fabric" || c.id === "feel" ? "" : ""}` : `You removed your ${c.label.toLowerCase()} preference` };
    }
    if (Boolean(a.must[c.id]) !== Boolean(b.must[c.id]))
      return { key: c.id, text: b.must[c.id] ? `You made ${c.label.toLowerCase()} a must-have` : `You made ${c.label.toLowerCase()} a preference` };
  }
  return { key: "", text: "With your updated brief" };

}

/** One or two sentences: the specific effect of a change, from before/after results. */
export function changeEffect(a: Brief, ra: Result, b: Brief, rb: Result, keyOf: (r: Result) => string): string {
  const cause = causeOf(a, b);
  const vb = rb.verdict;
  if (a.profile !== b.profile) return `Switched to ${profileOf(b).noun}. Your level and budget carried over; other preferences start fresh.`;
  if (vb.kind === "none") return vb.conflict.text;
  const newlyOut = rb.selected.filter((e) => !e.eligible && ra.selected.find((o) => o.p.id === e.p.id)?.eligible);
  const nowOut = (e: Eval) => {
    const c = e.blockers[0];
    if (c.id === "budget") return `The ${nm(e.p)} ${verb(e.p, "is", "are")} now above your budget.`;
    if (c.id === "stock") return `The ${nm(e.p)} ${verb(e.p, "is", "are")} currently unavailable.`;
    return c.status === "unknown"
      ? `The ${nm(e.p)} can't be confirmed for your ${c.label.toLowerCase()} must-have (not specified).`
      : `The ${nm(e.p)} no longer ${verb(e.p, "meets", "meet")} your ${c.label.toLowerCase()} must-have.`;
  };
  const outNote = newlyOut.map(nowOut).join(" ");
  const newlyIn = rb.alternatives.filter((e) => !ra.eligible.some((o) => o.p.id === e.p.id)).slice(0, 2);
  const inNote = newlyIn.length ? ` ${newlyIn.map((e) => `The ${nm(e.p)}`).join(" and ")} now ${newlyIn.length > 1 || plural(newlyIn[0].p) ? "fit" : "fits"} your brief; you can add ${newlyIn.length > 1 ? "them" : "it"} to the comparison.` : "";

  if (keyOf(ra) !== keyOf(rb)) {
    if (vb.kind === "pick" || vb.kind === "only") {
      const prevTop = ra.verdict.kind === "pick" || ra.verdict.kind === "only" ? ra.verdict.top : null;
      const vs = prevTop && prevTop.p.id !== vb.top.p.id ? prevTop : vb.kind === "pick" ? vb.alt : null;
      const delta = vs && vs.p.price !== vb.top.p.price ? ` ${they(vb.top.p)} ${verb(vb.top.p, "costs", "cost")} ${inr(Math.abs(vb.top.p.price - vs.p.price))} ${vb.top.p.price > vs.p.price ? "more" : "less"} than the ${nm(vs.p)}.` : "";
      const why = newlyOut.length ? outNote.replace(/\.$/, "") : cause.text;
      return `${why}, so the ${nm(vb.top.p)} now ${verb(vb.top.p, "ranks", "rank")} first.${delta}${inNote}`.trim();
    }
    if (vb.kind === "tie") return `${outNote ? outNote + " " : ""}${cause.text}: ${vb.group.map((e) => `the ${nm(e.p)}`).join(" and ")} now fit equally, so there's no clear winner.${inNote}`;
  }
  // unchanged
  const c = criterion(profileOf(b), cause.key);
  if (c && !c.informational && c.classify && asList(b.values[c.id]).length && rb.selected.every((e) => c.classify!(e.p) === null))
    return `${c.label} isn't listed for ${rb.selected.length > 1 ? "these products" : "this product"}, so this can't be evaluated. The recommendation is unchanged.`;
  if (cause.key === "budget" && rb.selected.every((e) => e.eligible) && rb.selected.length > 1)
    return `${rb.selected.length === 2 ? "Both products" : "All the products"} remain within your new budget, so the recommendation is unchanged.${inNote}`;
  const iv = c ? b.values[c.id] : null;
  if (c?.informational && c.implies && typeof iv === "string") {
    const imp = c.implies(iv);
    if (imp) return `${imp.note}. The recommendation is unchanged.${inNote}`;
  }
  const top = vb.kind === "pick" || vb.kind === "only" ? vb.top : null;
  return `${outNote ? outNote + " " : ""}The recommendation is unchanged${top ? `: the ${nm(top.p)} still ${verb(top.p, "ranks", "rank")} first` : ""}.${inNote}`;
}
