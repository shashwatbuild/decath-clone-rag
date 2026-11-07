"use client";

/**
 * The single live recommendation area in the chat, kept to one card:
 *   brief summary (chips) → one change note with Undo → tabs: Pick · Compare · Adjust · Kit.
 * Each fact appears in one place. Everything reads one Session and writes through the callbacks,
 * so chat messages, brief edits, controls and the kit stay in sync.
 */
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { img, inr } from "@/lib/products";
import type { CartItem, Product } from "@/lib/types";
import { evaluateBrief, verdictKey, type Brief, type BriefPatch, type Eval, type Result } from "@/lib/advisor/engine";
import { allSpecRows, briefLines, needsRows, recommend, type Row } from "@/lib/advisor/explain";
import { PROFILES, asList, criterion, type Criterion, type ProfileId } from "@/lib/advisor/profiles";
import type { Session, View } from "@/lib/advisor/session";
import type { KitItem, KitLine } from "@/lib/advisor/kit";
import KitBoard from "./KitBoard";

type Props = {
  session: Session;
  onCommit: (patch: BriefPatch, selected?: string[]) => void;
  onUndo: () => void;
  onAsk: (text: string, productId?: string) => void;
  saved: boolean;
  onSave: (save: boolean) => void;
  cart: CartItem[];
  onOpenKit: () => void;
  onKit: (items: Record<string, Partial<KitItem>>, budget?: number | null) => void;
  onAddKit: (lines: KitLine[]) => void;
  onView: (v: View) => void;
};

export default function AdvisorPanel(props: Props) {
  const { session, onCommit, onUndo, onAsk, saved, onSave, cart, onOpenKit, onKit, onAddKit, onView } = props;
  const { brief, selected } = session;
  const result = useMemo(() => evaluateBrief(brief, selected), [brief, selected]);
  const [editing, setEditing] = useState<string | null>(null);
  const hasKit = Boolean(PROFILES[brief.profile].kit);
  const view: View = session.view === "kit" && !hasKit ? "pick" : (session.view ?? "pick");
  const tabs: { id: View; label: string }[] = [
    { id: "pick", label: "Pick" },
    { id: "compare", label: "Compare" },
    { id: "adjust", label: "Adjust" },
    ...(hasKit ? [{ id: "kit" as View, label: "Kit" }] : []),
  ];

  return (
    <section aria-label="Your shopping recommendation" className="mt-1 border border-line rounded-2xl bg-white shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
      <BriefSummary brief={brief} onEdit={setEditing} saved={saved} onSave={onSave} />
      {session.change && <ChangeNote key={session.change.n} change={session.change} canUndo={session.undo.length > 0} onUndo={onUndo} />}

      <div role="tablist" aria-label="Recommendation sections" className="sticky top-0 z-10 bg-white/95 backdrop-blur border-y border-line px-2 flex">
        {tabs.map((t) => (
          <button key={t.id} role="tab" aria-selected={view === t.id} onClick={() => onView(t.id)}
            className={`flex-1 min-h-[46px] text-[14px] font-semibold border-b-2 -mb-px ${view === t.id ? "border-brand text-brand" : "border-transparent text-[#6b6b70]"}`}>
            {t.label}
          </button>
        ))}
      </div>

      <div className="px-4 py-4">
        {view === "pick" && <RecommendationCard result={result} brief={brief} onAsk={onAsk} onCommit={onCommit} onEdit={setEditing} onView={onView} />}
        {view === "compare" && (result.selected.length > 0
          ? <Comparison result={result} brief={brief} selected={selected} onSelect={(ids) => onCommit({}, ids)} />
          : <p className="text-[14px] text-muted">Nothing to compare yet. Change your brief in <b>Adjust</b>.</p>)}
        {view === "adjust" && <Adjust brief={brief} onCommit={onCommit} />}
        {view === "kit" && (session.kit
          ? <KitBoard brief={brief} kit={session.kit} cart={cart} onKit={onKit} onAddToCart={onAddKit} />
          : (
            <div className="text-center py-2">
              <p className="text-[15px] font-semibold">Build your activity kit</p>
              <p className="text-[14px] text-muted mt-1">Tell us what you already own. We&apos;ll only suggest what you still need.</p>
              <button onClick={onOpenKit} className="mt-3 rounded-full bg-brand text-white font-semibold text-[14px] px-5 min-h-[44px]">Start my kit</button>
            </div>
          ))}
      </div>
      {editing && <EditSheet field={editing} brief={brief} onCommit={onCommit} onClose={() => setEditing(null)} />}
    </section>
  );
}

// ------------------------------------------------------------------ brief (compact chips, full list on demand)

function BriefSummary({ brief, onEdit, saved, onSave }: { brief: Brief; onEdit: (k: string) => void; saved: boolean; onSave: (s: boolean) => void }) {
  const [open, setOpen] = useState(false);
  const lines = briefLines(brief).filter((l) => l.key !== "priority" || brief.priority !== "match");
  return (
    <div className="px-4 pt-3.5 pb-3">
      <div className="flex items-center justify-between">
        <h3 className="font-bold text-[15px]">Your brief</h3>
        <button onClick={() => setOpen((o) => !o)} aria-expanded={open} className="text-brand text-[14px] font-semibold min-h-[36px] px-1">{open ? "Done" : "Edit"}</button>
      </div>
      {!open ? (
        <ul className="flex flex-wrap gap-1.5 mt-1">
          {lines.map((l) => (
            <li key={l.key}>
              <button onClick={() => onEdit(l.key)} aria-label={`${l.label}: ${l.value}. Edit`}
                className={`rounded-full text-[13px] px-3 min-h-[32px] border ${l.kind === "must" ? "bg-brand border-brand text-white" : "bg-[#F5F5F7] border-[#F5F5F7] text-[#222]"}`}>
                {l.key === "budget" ? l.value.replace("Up to ", "≤ ") : l.key === "profile" ? PROFILES[brief.profile].noun.replace(/^./, (c) => c.toUpperCase()) : l.value}
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <>
          <ul className="mt-1 divide-y divide-line">
            {lines.map((l) => (
              <li key={l.key}>
                <button onClick={() => onEdit(l.key)} className="w-full flex items-center gap-2 min-h-[44px] py-1.5 text-left" aria-label={`${l.label}: ${l.value}. Edit`}>
                  <span className="text-[13px] text-muted w-[36%] shrink-0 leading-tight">{l.label}{l.hint && <span className="block text-[12px]">{l.hint}</span>}</span>
                  <span className="text-[14px] font-medium flex-1 min-w-0">{l.value}</span>
                  {l.kind === "must" && <span className="text-[12px] font-semibold rounded-full px-2 py-0.5 bg-brand text-white shrink-0">Must</span>}
                  <svg aria-hidden viewBox="0 0 24 24" className="w-4 h-4 text-[#9a9a9a] shrink-0"><path d="M9 6l6 6-6 6" fill="none" stroke="currentColor" strokeWidth="2" /></svg>
                </button>
              </li>
            ))}
          </ul>
          <button onClick={() => onSave(!saved)} className="mt-2 text-[13px] text-brand font-semibold min-h-[36px]">
            {saved ? "Saved on this device · Forget" : "Save for future shopping (this device)"}
          </button>
        </>
      )}
      {!open && <p className="text-[12px] text-muted mt-2">Filled = must-have. Tap any item to change it.</p>}
    </div>
  );
}

function ChangeNote({ change, canUndo, onUndo }: { change: NonNullable<Session["change"]>; canUndo: boolean; onUndo: () => void }) {
  return (
    <div role="status" aria-live="polite" className="adv-in mx-4 mb-3 flex items-start gap-3 rounded-xl bg-brand-soft/70 px-3.5 py-2.5">
      <p className="text-[14px] leading-snug flex-1">{change.effect}</p>
      {canUndo && <button onClick={onUndo} className="text-brand font-semibold text-[14px] min-h-[32px] shrink-0">Undo</button>}
    </div>
  );
}

// ------------------------------------------------------------------ pick (recommendation)

function ProductRow({ p, onAsk, compact }: { p: Product; onAsk: Props["onAsk"]; compact?: boolean }) {
  return (
    <div className="flex gap-3 items-center">
      <Link href={`/p/${p.id}`} className="shrink-0">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={img(p.images[0], 180)} alt="" className={`${compact ? "w-14 h-14" : "w-[76px] h-[76px]"} rounded-xl object-cover bg-[#F5F4F5]`} />
      </Link>
      <Link href={`/p/${p.id}`} className="min-w-0 flex-1">
        <span className="block text-[15px] font-semibold leading-snug line-clamp-2">{p.shortName}</span>
        <span className="block text-[14px] mt-0.5"><b>{inr(p.price)}</b>{p.mrp > p.price && <s className="text-muted ml-1.5 text-[13px]">{inr(p.mrp)}</s>}</span>
        <span className="block text-[13px] text-muted">{p.reviewCount ? `★ ${p.rating} · ${p.reviewCount.toLocaleString("en-IN")} reviews` : "No reviews yet"}</span>
      </Link>
      {compact && <button onClick={() => onAsk(`Add ${p.shortName} to cart`, p.id)} className="rounded-full border border-brand text-brand text-[13px] font-semibold px-3 min-h-[38px] shrink-0">Add</button>}
    </div>
  );
}

function RecommendationCard({ result, brief, onAsk, onCommit, onEdit, onView }: { result: Result; brief: Brief; onAsk: Props["onAsk"]; onCommit: Props["onCommit"]; onEdit: (k: string) => void; onView: (v: View) => void }) {
  const rec = recommend(result, brief);
  const v = result.verdict;
  const tops: Eval[] = v.kind === "pick" || v.kind === "only" ? [v.top] : v.kind === "tie" ? v.group : [];
  const vsName = v.kind === "pick" ? v.alt.p.shortName : null;
  const label = v.kind === "none" ? "No match yet" : v.kind === "tie" ? rec.title : "Our pick for you";
  return (
    <div key={verdictKey(result)} className="adv-flash rounded-xl -m-1 p-1">
      <p className="text-[12px] font-bold uppercase tracking-wide text-brand">{label}</p>

      {v.kind === "none" && (
        <>
          <p className="text-[15px] mt-1.5 leading-snug">{rec.headline}</p>
          <div className="flex flex-wrap gap-2 mt-3">
            {v.conflict.fixes.map((f) => (
              <button key={f.label} onClick={() => onCommit(f.patch)} className="rounded-full bg-brand text-white text-[14px] font-semibold px-4 min-h-[40px]">{f.label}</button>
            ))}
            <button onClick={() => onEdit("budget")} className="rounded-full border border-brand text-brand text-[14px] font-semibold px-4 min-h-[40px]">Edit brief</button>
          </div>
        </>
      )}

      {tops.length === 1 && (
        <div className="mt-2">
          <ProductRow p={tops[0].p} onAsk={onAsk} />
          <p className="text-[14px] text-[#3a3a3c] mt-3 leading-[1.5]">{rec.headline}</p>
          <button onClick={() => onAsk(`Add ${tops[0].p.shortName} to cart`, tops[0].p.id)} className="mt-3 w-full rounded-full bg-brand text-white font-semibold text-[15px] min-h-[46px]">Add to cart</button>
        </div>
      )}
      {tops.length > 1 && (
        <div className="mt-2 space-y-3">
          <p className="text-[14px] text-[#3a3a3c] leading-[1.5]">{rec.headline}</p>
          {tops.map((e) => <ProductRow key={e.p.id} p={e.p} onAsk={onAsk} compact />)}
        </div>
      )}

      {v.kind !== "none" && (
        <div className="mt-4 divide-y divide-line border-y border-line">
          {rec.why.length > 0 && <Fold title="Why it fits" items={rec.why} mark="✓" />}
          {rec.giveUp.length > 0 && <Fold title={vsName ? `What you give up vs ${vsName}` : "Trade-offs"} items={rec.giveUp} mark="–" />}
          {rec.check.length > 0 && <Fold title="Still to check" items={rec.check} mark="?" />}
          {rec.evidence.length > 0 && (
            <details className="group">
              <summary className="cursor-pointer list-none flex items-center justify-between min-h-[46px] text-[14px] font-semibold">
                Product evidence <Chevron />
              </summary>
              <div className="pb-3 space-y-3">
                {rec.evidence.map((ev) => (
                  <div key={ev.product.id}>
                    <Link href={`/p/${ev.product.id}`} className="text-[13px] font-semibold underline">{ev.product.shortName}</Link>
                    <dl className="mt-1 text-[13px] grid grid-cols-[minmax(0,42%)_1fr] gap-x-2 gap-y-1">
                      {ev.items.map((it, i) => (
                        <div key={i} className="contents">
                          <dt className="text-muted">{it.field}</dt>
                          <dd className={it.value === "Not specified" ? "text-[#8a8a8a]" : ""}>{it.value}</dd>
                        </div>
                      ))}
                    </dl>
                  </div>
                ))}
                <p className="text-[12px] text-muted">Taken from each product&apos;s catalogue listing.</p>
              </div>
            </details>
          )}
        </div>
      )}
      {v.kind !== "none" && (
        <div className="flex gap-4 mt-3 text-[14px] font-semibold text-brand">
          <button onClick={() => onView("compare")} className="min-h-[36px]">Compare options →</button>
          <button onClick={() => onView("adjust")} className="min-h-[36px]">What changes if…? →</button>
        </div>
      )}
    </div>
  );
}

function Chevron() {
  return <svg aria-hidden viewBox="0 0 24 24" className="w-4 h-4 text-[#8a8a8a] transition-transform group-open:rotate-180"><path d="M6 9l6 6 6-6" fill="none" stroke="currentColor" strokeWidth="2" /></svg>;
}

function Fold({ title, items, mark }: { title: string; items: string[]; mark: string }) {
  return (
    <details className="group">
      <summary className="cursor-pointer list-none flex items-center justify-between gap-2 min-h-[46px] text-[14px] font-semibold">
        <span>{title} <span className="text-muted font-normal">({items.length})</span></span>
        <Chevron />
      </summary>
      <ul className="pb-3 space-y-1.5">
        {items.map((t) => (
          <li key={t} className="text-[14px] leading-snug flex gap-2">
            <span aria-hidden className={`shrink-0 w-4 text-center font-bold ${mark === "✓" ? "text-[#1b7d3a]" : mark === "–" ? "text-[#b3261e]" : "text-[#8a6d00]"}`}>{mark}</span>
            <span>{t}</span>
          </li>
        ))}
      </ul>
    </details>
  );
}

// ------------------------------------------------------------------ compare

function Comparison({ result, brief, selected, onSelect }: { result: Result; brief: Brief; selected: string[]; onSelect: (ids: string[]) => void }) {
  const [mode, setMode] = useState<"needs" | "all">("needs");
  const rows: Row[] = mode === "needs" ? needsRows(result, brief) : allSpecRows(result);
  const n = result.selected.length;
  const top = result.verdict.kind === "pick" || result.verdict.kind === "only" ? result.verdict.top.p.id : null;
  const firstAlt = result.alternatives[0];
  return (
    <div>
      <div role="tablist" aria-label="Comparison view" className="grid grid-cols-2 bg-[#F0F0F3] rounded-full p-0.5">
        {(["needs", "all"] as const).map((k) => (
          <button key={k} role="tab" aria-selected={mode === k} onClick={() => setMode(k)}
            className={`text-[13px] font-semibold rounded-full px-3 min-h-[36px] ${mode === k ? "bg-white text-brand shadow-sm" : "text-[#555]"}`}>
            {k === "needs" ? "For your needs" : "All specifications"}
          </button>
        ))}
      </div>
      <div className="grid mt-3 -mx-4 border-t border-line" style={{ gridTemplateColumns: `76px repeat(${n}, minmax(0,1fr))` }}>
        <div />
        {result.selected.map((e) => (
          <div key={e.p.id} className={`p-2 border-l border-line ${e.eligible ? "" : "bg-[#FFF6F5]"}`}>
            <div className="relative">
              <Link href={`/p/${e.p.id}`} aria-label={e.p.shortName}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={img(e.p.images[0], 200)} alt="" className={`w-full aspect-square object-cover bg-[#F5F4F5] rounded-lg ${e.eligible ? "" : "opacity-60"}`} />
              </Link>
              {e.p.id === top && <span className="absolute top-1 left-1 bg-brand text-white text-[11px] font-bold rounded px-1.5 py-0.5">Our pick</span>}
              {n > 2 && (
                <button onClick={() => onSelect(selected.filter((id) => id !== e.p.id))} aria-label={`Remove ${e.p.shortName} from comparison`}
                  className="absolute top-1 right-1 w-7 h-7 rounded-full bg-white/95 shadow-sm text-[15px] leading-none">×</button>
              )}
            </div>
            <Link href={`/p/${e.p.id}`} className="block text-[13px] font-semibold leading-tight mt-1.5 line-clamp-2">{e.p.shortName}</Link>
            {/* only what the rows below don't already say: why a product is out */}
            {e.blockers.map((b) => (
              <p key={b.id} className="mt-1 text-[12px] font-semibold text-[#9b1c13]">
                {b.id === "budget" ? "Above your budget" : b.id === "stock" ? "Unavailable" : `Doesn't meet ${b.label.toLowerCase()} must-have`}
              </p>
            ))}
            {!e.eligible && firstAlt && (
              <button onClick={() => onSelect(selected.map((id) => (id === e.p.id ? firstAlt.p.id : id)))}
                className="mt-1 text-[12px] font-semibold text-brand underline text-left min-h-[28px]">Swap for {firstAlt.p.shortName}</button>
            )}
          </div>
        ))}
        {rows.map((r) => (
          <div key={r.label} className="contents">
            <div className="text-[12px] font-semibold text-[#555] p-2 border-t border-line bg-[#FAFAFA] break-words hyphens-auto">{r.label}</div>
            {r.cells.map((c, i) => (
              <div key={i} className={`text-[13px] leading-snug p-2 border-t border-l border-line break-words hyphens-auto ${c.tone === "good" ? "text-[#1b5e2f]" : c.tone === "bad" ? "text-[#9b1c13]" : c.tone === "muted" ? "text-[#8a8a8a]" : ""}`}>{c.text}</div>
            ))}
          </div>
        ))}
      </div>
      {result.alternatives.length > 0 && n < 3 && (
        <div className="pt-3 -mx-4 px-4 border-t border-line">
          <p className="text-[13px] text-muted mb-1.5">Also fits your must-haves</p>
          <div className="flex flex-wrap gap-1.5">
            {result.alternatives.slice(0, 3).map((e) => (
              <button key={e.p.id} onClick={() => onSelect([...selected, e.p.id])} className="rounded-full border border-brand text-brand text-[13px] px-3 min-h-[36px]">
                + {e.p.shortName} · {inr(e.p.price)}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ------------------------------------------------------------------ what changes if…?

function Segmented({ label, options, value, onChange }: { label: string; options: { id: string; label: string }[]; value: string; onChange: (id: string) => void }) {
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-1.5">
      {options.map((o) => (
        <button key={o.id} role="radio" aria-checked={value === o.id} onClick={() => value !== o.id && onChange(o.id)}
          className={`rounded-full text-[14px] px-3.5 min-h-[38px] border ${value === o.id ? "bg-brand border-brand text-white font-semibold" : "border-[#c9c9cf] text-[#222] bg-white"}`}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

const NONE = "__none";

/** Single choice (radio chips) or, for multi-select criteria, toggle chips. */
function Choice({ c, brief, onCommit }: { c: Criterion; brief: Brief; onCommit: Props["onCommit"] }) {
  if (!c.multi) return <Segmented label={c.label} options={critOptions(c)} value={critValue(brief, c)} onChange={(id) => onCommit({ values: { [c.id]: id === NONE ? null : id } })} />;
  const cur = asList(brief.values[c.id]);
  const toggle = (id: string) => {
    const next = cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id];
    onCommit({ values: { [c.id]: next.length ? next : null } });
  };
  return (
    <div role="group" aria-label={`${c.label} (choose any)`} className="flex flex-wrap gap-1.5">
      {c.options.map((o) => (
        <button key={o.id} aria-pressed={cur.includes(o.id)} onClick={() => toggle(o.id)}
          className={`rounded-full text-[14px] px-3.5 min-h-[38px] border ${cur.includes(o.id) ? "bg-brand border-brand text-white font-semibold" : "border-[#c9c9cf] text-[#222] bg-white"}`}>
          {cur.includes(o.id) ? "✓ " : ""}{o.label}
        </button>
      ))}
      <button aria-pressed={brief.values[c.id] === null} onClick={() => brief.values[c.id] !== null && onCommit({ values: { [c.id]: null } })}
        className={`rounded-full text-[14px] px-3.5 min-h-[38px] border ${brief.values[c.id] === null ? "bg-brand border-brand text-white font-semibold" : "border-[#c9c9cf] text-[#222] bg-white"}`}>{c.noneLabel}</button>
    </div>
  );
}

/** Don't mind / Prefer / Require, for a yes-or-no feature such as pockets. */
function RequireControl({ c, brief, onCommit }: { c: Criterion; brief: Brief; onCommit: Props["onCommit"] }) {
  const on = asList(brief.values[c.id]).length > 0;
  const value = !on ? "none" : brief.must[c.id] ? "must" : "pref";
  return (
    <Segmented label={c.label} value={value}
      options={[{ id: "none", label: "Don't mind" }, { id: "pref", label: "Prefer" }, { id: "must", label: "Require" }]}
      onChange={(id) => onCommit(id === "none" ? { values: { [c.id]: null }, must: { [c.id]: false } } : { values: { [c.id]: c.options[0].id }, must: { [c.id]: id === "must" } })} />
  );
}

/** "Refine my preferences": the remaining catalogue-backed preferences, collapsed by default. */
function Refine({ brief, onCommit }: { brief: Brief; onCommit: Props["onCommit"] }) {
  const profile = PROFILES[brief.profile];
  const inControls = new Set(profile.controls.flatMap((c) => ("id" in c ? [c.id] : [])));
  const list = profile.criteria.filter((c) => c.refine && !inControls.has(c.id));
  if (!list.length) return null;
  const set = list.filter((c) => c.id in brief.values).length;
  return (
    <details className="group mt-5 border-t border-line">
      <summary className="cursor-pointer list-none flex items-center justify-between min-h-[50px]">
        <span className="font-semibold text-[14px]">Refine my preferences <span className="font-normal text-muted">{set ? `(${set} set)` : "(optional)"}</span></span>
        <Chevron />
      </summary>
      <div className="pb-2 space-y-5">
        {list.map((c) => (
          <div key={c.id}>
            <p className="text-[14px] font-semibold mb-2">{c.label}</p>
            {c.canBeMust && c.options.length === 1 ? <RequireControl c={c} brief={brief} onCommit={onCommit} /> : <Choice c={c} brief={brief} onCommit={onCommit} />}
            {c.benefitBased && <p className="text-[12px] text-muted mt-1.5">Only counted when a product lists it as a benefit.</p>}
          </div>
        ))}
      </div>
    </details>
  );
}
const critOptions = (c: Criterion) => [...c.options.map((o) => ({ id: o.id, label: o.label })), { id: NONE, label: c.noneLabel }];
/** "" = never answered: no option is shown as selected */
const critValue = (b: Brief, c: Criterion): string => {
  const v = b.values[c.id];
  return v === undefined ? "" : v === null ? NONE : Array.isArray(v) ? (v[0] ?? NONE) : v;
};

function BudgetControl({ brief, onCommit }: { brief: Brief; onCommit: Props["onCommit"] }) {
  const range = PROFILES[brief.profile].budget;
  const [draft, setDraft] = useState<number>(brief.budget ?? range.max);
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => { setDraft(brief.budget ?? range.max); }, [brief.budget, range.max]);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  const commitSoon = (v: number) => {
    setDraft(v);
    window.clearTimeout(timer.current);
    // rapid slider moves settle into one change (one Undo step)
    timer.current = window.setTimeout(() => onCommit({ budget: v }), 450);
  };
  const id = `budget-${brief.profile}`;
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <label htmlFor={id} className="text-[14px] font-semibold">Budget</label>
        <output htmlFor={id} className="text-[15px] font-bold text-brand">{brief.budget === null && draft === range.max ? "No limit" : `Up to ${inr(draft)}`}</output>
      </div>
      <input id={id} type="range" min={range.min} max={range.max} step={range.step} value={draft}
        onChange={(e) => commitSoon(Number(e.target.value))}
        className="w-full accent-[#3643ba] h-8" aria-valuetext={inr(draft)} />
      <div className="flex justify-between text-[12px] text-muted">
        <span>{inr(range.min)}</span>
        {brief.budget !== null && <button onClick={() => onCommit({ budget: null })} className="text-brand font-semibold min-h-[28px]">Remove limit</button>}
        <span>{inr(range.max)}</span>
      </div>
    </div>
  );
}

function Adjust({ brief, onCommit }: { brief: Brief; onCommit: Props["onCommit"] }) {
  const profile = PROFILES[brief.profile];
  return (
    <div>
      <p className="text-[14px] font-semibold">What changes if…?</p>
      <p className="text-[13px] text-muted mb-4">Change anything; the pick and comparison update, and you can undo.</p>
      <div className="space-y-5">
        {profile.controls.map((ctl) => {
          if (ctl.kind === "budget") return <BudgetControl key="budget" brief={brief} onCommit={onCommit} />;
          if (ctl.kind === "priority")
            return (
              <div key="priority">
                <p className="text-[14px] font-semibold mb-2">Prioritise</p>
                <Segmented label="Prioritise" options={profile.priorities} value={brief.priority} onChange={(id) => onCommit({ priority: id })} />
              </div>
            );
          const c = criterion(profile, ctl.id)!;
          return (
            <div key={c.id}>
              <p className="text-[14px] font-semibold mb-2">{c.label}{brief.must[c.id] ? <span className="ml-1.5 text-[12px] font-semibold rounded-full px-2 py-0.5 bg-brand text-white align-middle">Must</span> : null}</p>
              {ctl.kind === "require" ? <RequireControl c={c} brief={brief} onCommit={onCommit} /> : <Choice c={c} brief={brief} onCommit={onCommit} />}
            </div>
          );
        })}
      </div>
      <Refine brief={brief} onCommit={onCommit} />
    </div>
  );
}

// ------------------------------------------------------------------ bottom sheet editor

function EditSheet({ field, brief, onCommit, onClose }: { field: string; brief: Brief; onCommit: Props["onCommit"]; onClose: () => void }) {
  const profile = PROFILES[brief.profile];
  const c = criterion(profile, field);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.querySelector<HTMLElement>("button, input")?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  let title = "";
  let body: React.ReactNode = null;
  if (field === "budget") {
    title = "Budget";
    body = (
      <>
        <BudgetControl brief={brief} onCommit={onCommit} />
        <p className="text-[13px] text-muted mt-2">Products above it are marked, never quietly included.</p>
      </>
    );
  } else if (field === "size") {
    title = "Size";
    body = <p className="text-[14px]">Size {brief.size} came from your cart or kit choice. Pick a different size when you add a product to the cart (each product page has a size guide).</p>;
  } else if (field === "priority") {
    title = "Priority";
    body = <Segmented label="Priority" options={profile.priorities} value={brief.priority} onChange={(id) => onCommit({ priority: id })} />;
  } else if (field === "profile") {
    title = "Activity";
    body = (
      <>
        <Segmented label="Activity" options={(Object.keys(PROFILES) as ProfileId[]).map((id) => ({ id, label: PROFILES[id].noun.charAt(0).toUpperCase() + PROFILES[id].noun.slice(1) }))}
          value={brief.profile} onChange={(id) => onCommit({ profile: id as ProfileId })} />
        <p className="text-[12px] text-muted mt-2">Switching keeps your level and budget; other preferences start fresh. You can undo.</p>
      </>
    );
  } else if (c) {
    title = c.label;
    body = (
      <>
        <Choice c={c} brief={brief} onCommit={onCommit} />
        {c.canBeMust && asList(brief.values[c.id]).length > 0 && (
          <div className="mt-4">
            <p className="text-[13px] font-semibold mb-1.5">How strict?</p>
            <Segmented label={`${c.label}: must-have or preference`} options={[{ id: "pref", label: "Preference (rank higher)" }, { id: "must", label: "Must-have (filter)" }]}
              value={brief.must[c.id] ? "must" : "pref"} onChange={(id) => onCommit({ must: { [c.id]: id === "must" } })} />
          </div>
        )}
        {c.informational && <p className="text-[12px] text-muted mt-2">Recorded in your brief{c.implies ? "; it sets a suggested minimum capacity you can change" : ""}.</p>}
        {!c.informational && <p className="text-[13px] text-muted mt-3">Products that don&apos;t list this show “Not specified”.</p>}
      </>
    );
  }
  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end" role="dialog" aria-modal="true" aria-label={`Edit ${title}`}>
      <button aria-label="Close" onClick={onClose} className="absolute inset-0 bg-black/40" />
      <div ref={ref} className="adv-sheet relative bg-white rounded-t-3xl px-5 pt-3 pb-8 max-h-[80%] overflow-y-auto">
        <div className="mx-auto w-10 h-1.5 rounded-full bg-[#d5d5d8] mb-3" />
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-bold text-[17px]">Edit {title.toLowerCase()}</h3>
          <button onClick={onClose} className="text-brand font-semibold text-[15px] min-h-[40px] px-2">Done</button>
        </div>
        {body}
      </div>
    </div>
  );
}
