"use client";

/**
 * The single live recommendation area in the chat: activity brief → what changed → recommendation →
 * comparison → "What changes if…?". Everything reads one Session and writes through onCommit / onUndo,
 * so chat messages, brief edits and the controls stay in sync.
 */
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { img, inr } from "@/lib/products";
import type { Product } from "@/lib/types";
import { evaluateBrief, verdictKey, type Brief, type BriefPatch, type Eval, type Result } from "@/lib/advisor/engine";
import { allSpecRows, briefLines, labelsFor, needsRows, recommend, type Row } from "@/lib/advisor/explain";
import { PROFILES, criterion, optionLabel, type Criterion, type ProfileId } from "@/lib/advisor/profiles";
import type { Session } from "@/lib/advisor/session";

type Props = {
  session: Session;
  onCommit: (patch: BriefPatch, selected?: string[]) => void;
  onUndo: () => void;
  onAsk: (text: string, productId?: string) => void;
  saved: boolean;
  onSave: (save: boolean) => void;
};

export default function AdvisorPanel({ session, onCommit, onUndo, onAsk, saved, onSave }: Props) {
  const { brief, selected } = session;
  const result = useMemo(() => evaluateBrief(brief, selected), [brief, selected]);
  const [editing, setEditing] = useState<string | null>(null);

  return (
    <section aria-label="Your shopping recommendation" className="space-y-3 mt-1">
      <BriefCard brief={brief} change={session.change} onEdit={setEditing} saved={saved} onSave={onSave} />
      {session.change && <ChangeBanner key={session.change.n} change={session.change} canUndo={session.undo.length > 0} onUndo={onUndo} />}
      <RecommendationCard result={result} brief={brief} onAsk={onAsk} onCommit={onCommit} onEdit={setEditing} />
      {result.selected.length > 0 && <Comparison result={result} brief={brief} selected={selected} onSelect={(ids) => onCommit({}, ids)} />}
      <WhatIf brief={brief} onCommit={onCommit} change={session.change} canUndo={session.undo.length > 0} onUndo={onUndo} />
      {editing && <EditSheet field={editing} brief={brief} onCommit={onCommit} onClose={() => setEditing(null)} />}
    </section>
  );
}

// ------------------------------------------------------------------ brief

function BriefCard({ brief, change, onEdit, saved, onSave }: { brief: Brief; change: Session["change"]; onEdit: (k: string) => void; saved: boolean; onSave: (s: boolean) => void }) {
  const lines = briefLines(brief);
  const changed = new Set((change?.lines ?? []).map((l) => l.split(":")[0]));
  return (
    <div className="border border-line rounded-2xl bg-white overflow-hidden">
      <div className="flex items-center justify-between px-4 pt-3.5 pb-2">
        <h3 className="font-bold text-[15px]">Your activity brief</h3>
        <span className="text-[12px] text-muted">Tap a value to edit</span>
      </div>
      <ul className="divide-y divide-line border-t border-line">
        {lines.map((l) => (
          <li key={l.key + l.label}>
            <button
              onClick={() => onEdit(l.key)}
              className={`w-full flex items-center gap-2 px-4 min-h-[44px] py-2 text-left ${changed.has(l.label) ? "adv-flash" : ""}`}
              aria-label={`${l.label}: ${l.value}. Edit`}
            >
              <span className="text-[13px] text-muted w-[38%] shrink-0 leading-tight">{l.label}{l.hint && <span className="block text-[11px]">{l.hint}</span>}</span>
              <span className={`text-[14px] font-medium flex-1 min-w-0 ${l.value === "Not set" ? "text-[#8a8a8a] font-normal" : ""}`}>{l.value}</span>
              {l.kind === "must" && <Tag tone="must">Must-have</Tag>}
              {l.kind === "pref" && <Tag tone="pref">Preference</Tag>}
              <svg aria-hidden viewBox="0 0 24 24" className="w-4 h-4 text-[#9a9a9a] shrink-0"><path d="M9 6l6 6-6 6" fill="none" stroke="currentColor" strokeWidth="2" /></svg>
            </button>
          </li>
        ))}
      </ul>
      <div className="px-4 py-2.5 bg-[#FAFAFB] border-t border-line flex items-center gap-2 text-[12px] text-muted">
        {saved ? (
          <>
            <span className="flex-1">Saved on this device for future shopping (budget not saved).</span>
            <button onClick={() => onSave(false)} className="text-brand font-semibold min-h-[32px]">Forget</button>
          </>
        ) : (
          <>
            <span className="flex-1">Used for this chat only.</span>
            <button onClick={() => onSave(true)} className="text-brand font-semibold min-h-[32px]">Save for future shopping</button>
          </>
        )}
      </div>
    </div>
  );
}

function Tag({ tone, children }: { tone: "must" | "pref"; children: React.ReactNode }) {
  return (
    <span className={`text-[11px] font-semibold rounded-full px-2 py-0.5 shrink-0 ${tone === "must" ? "bg-brand text-white" : "bg-brand-soft text-brand"}`}>{children}</span>
  );
}

function ChangeBanner({ change, canUndo, onUndo }: { change: NonNullable<Session["change"]>; canUndo: boolean; onUndo: () => void }) {
  return (
    <div role="status" aria-live="polite" className="adv-in border border-brand/30 bg-brand-soft/60 rounded-2xl px-4 py-3">
      {change.lines.length > 0 && (
        <ul className="text-[12px] text-brand font-semibold space-y-0.5 mb-1.5">
          {change.lines.map((l) => <li key={l}>{change.undone ? "↩" : "✎"} {l}</li>)}
        </ul>
      )}
      <p className="text-[14px] leading-snug">{change.effect}</p>
      {canUndo && (
        <button onClick={onUndo} className="mt-2 rounded-full border border-brand text-brand font-semibold text-[13px] px-4 min-h-[36px]">Undo</button>
      )}
    </div>
  );
}

// ------------------------------------------------------------------ recommendation

function Mini({ p, badge }: { p: Product; badge?: string }) {
  return (
    <Link href={`/p/${p.id}`} className="flex gap-3 items-center">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={img(p.images[0], 160)} alt="" className="w-16 h-16 rounded-lg object-cover bg-[#F5F4F5] shrink-0" />
      <span className="min-w-0">
        {badge && <span className="block text-[11px] font-semibold text-brand uppercase tracking-wide">{badge}</span>}
        <span className="block text-[14px] font-semibold leading-snug line-clamp-2">{p.shortName}</span>
        <span className="block text-[13px]"><b>{inr(p.price)}</b>{p.mrp > p.price && <s className="text-muted ml-1.5 text-[12px]">{inr(p.mrp)}</s>}</span>
        <span className="block text-[12px] text-muted">{p.reviewCount ? `★ ${p.rating} · ${p.reviewCount.toLocaleString("en-IN")} reviews` : "No reviews yet"}</span>
      </span>
    </Link>
  );
}

function RecommendationCard({ result, brief, onAsk, onCommit, onEdit }: { result: Result; brief: Brief; onAsk: Props["onAsk"]; onCommit: Props["onCommit"]; onEdit: (k: string) => void }) {
  const rec = recommend(result, brief);
  const v = result.verdict;
  const tops: Eval[] = v.kind === "pick" || v.kind === "only" ? [v.top] : v.kind === "tie" ? v.group : [];
  const vsName = v.kind === "pick" ? v.alt.p.shortName : v.kind === "only" && result.selected.find((e) => e !== v.top) ? result.selected.find((e) => e !== v.top)!.p.shortName : null;
  return (
    <div key={verdictKey(result)} className="adv-flash border-2 border-brand rounded-2xl bg-white px-4 py-3.5">
      <h3 className="font-bold text-[16px] text-brand">{rec.title}</h3>
      <p className="text-[14px] mt-1 leading-snug">{rec.headline}</p>

      {v.kind === "none" && (
        <div className="flex flex-wrap gap-2 mt-3">
          {v.conflict.fixes.map((f) => (
            <button key={f.label} onClick={() => onCommit(f.patch)} className="rounded-full bg-brand text-white text-[13px] font-semibold px-4 min-h-[38px]">{f.label}</button>
          ))}
          <button onClick={() => onEdit("budget")} className="rounded-full border border-brand text-brand text-[13px] font-semibold px-4 min-h-[38px]">Edit brief</button>
        </div>
      )}

      {tops.map((e) => (
        <div key={e.p.id} className="mt-3 flex items-center gap-2">
          <div className="flex-1 min-w-0"><Mini p={e.p} badge={v.kind === "tie" ? "Suitable" : undefined} /></div>
          <button onClick={() => onAsk(`Add ${e.p.shortName} to cart`, e.p.id)} className="rounded-full bg-brand text-white text-[13px] font-semibold px-3.5 min-h-[40px] shrink-0">
            Add to cart
          </button>
        </div>
      ))}

      {rec.why.length > 0 && <List title={v.kind === "tie" ? "Why these fit your needs" : "Why this fits your stated needs"} items={rec.why} mark="✓" />}
      {rec.giveUp.length > 0 && <List title={vsName ? `What you give up vs the ${vsName}` : "Trade-offs"} items={rec.giveUp} mark="–" />}
      {rec.check.length > 0 && <List title="What still needs checking" items={rec.check} mark="?" />}

      {rec.evidence.length > 0 && (
        <details className="mt-3 group">
          <summary className="cursor-pointer text-[13px] font-semibold text-brand min-h-[32px] flex items-center">View product evidence</summary>
          <div className="mt-1 space-y-3">
            {rec.evidence.map((ev) => (
              <div key={ev.product.id}>
                <Link href={`/p/${ev.product.id}`} className="text-[13px] font-semibold underline">{ev.product.shortName}</Link>
                <dl className="mt-1 text-[12px] grid grid-cols-[minmax(0,44%)_1fr] gap-x-2 gap-y-1">
                  {ev.items.map((it, i) => (
                    <div key={i} className="contents">
                      <dt className="text-muted">{it.source} › {it.field}</dt>
                      <dd className={it.value === "Not specified" ? "text-[#8a8a8a] italic" : ""}>{it.value}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            ))}
            <p className="text-[11px] text-muted">From the catalogue fields of each product. Explanations are generated from these facts and the ranking rules; nothing else is assumed.</p>
          </div>
        </details>
      )}
    </div>
  );
}

function List({ title, items, mark }: { title: string; items: string[]; mark: string }) {
  return (
    <div className="mt-3">
      <p className="text-[12px] font-bold uppercase tracking-wide text-[#555]">{title}</p>
      <ul className="mt-1 space-y-1">
        {items.map((t) => (
          <li key={t} className="text-[13px] leading-snug flex gap-2">
            <span aria-hidden className={`shrink-0 w-4 text-center font-bold ${mark === "✓" ? "text-[#1b7d3a]" : mark === "–" ? "text-[#b3261e]" : "text-[#8a6d00]"}`}>{mark}</span>
            <span>{t}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ------------------------------------------------------------------ comparison

function Comparison({ result, brief, selected, onSelect }: { result: Result; brief: Brief; selected: string[]; onSelect: (ids: string[]) => void }) {
  const [view, setView] = useState<"needs" | "all">("needs");
  const rows: Row[] = view === "needs" ? needsRows(result, brief) : allSpecRows(result);
  const n = result.selected.length;
  const top = result.verdict.kind === "pick" || result.verdict.kind === "only" ? result.verdict.top.p.id : null;
  const firstAlt = result.alternatives[0];
  return (
    <div className="border border-line rounded-2xl bg-white overflow-hidden">
      <div className="px-4 pt-3 pb-2.5">
        <h3 className="font-bold text-[15px] mb-2">Comparison</h3>
        <div role="tablist" aria-label="Comparison view" className="grid grid-cols-2 bg-[#F0F0F3] rounded-full p-0.5">
          {(["needs", "all"] as const).map((k) => (
            <button key={k} role="tab" aria-selected={view === k} onClick={() => setView(k)}
              className={`text-[12px] font-semibold rounded-full px-3 min-h-[32px] ${view === k ? "bg-white text-brand shadow-sm" : "text-[#555]"}`}>
              {k === "needs" ? "For your needs" : "All specifications"}
            </button>
          ))}
        </div>
      </div>
      <div className="grid border-t border-line" style={{ gridTemplateColumns: `72px repeat(${n}, minmax(0,1fr))` }}>
        <div />
        {result.selected.map((e) => {
          const labels = labelsFor(e, result, brief);
          return (
            <div key={e.p.id} className={`p-2 border-l border-line ${e.eligible ? "" : "bg-[#FFF6F5]"}`}>
              <div className="relative">
                <Link href={`/p/${e.p.id}`} aria-label={e.p.shortName}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={img(e.p.images[0], 200)} alt="" className={`w-full aspect-square object-cover bg-[#F5F4F5] rounded ${e.eligible ? "" : "opacity-60"}`} />
                </Link>
                {e.p.id === top && <span className="absolute top-1 left-1 bg-brand text-white text-[10px] font-bold rounded px-1.5 py-0.5">#1</span>}
                {n > 2 && (
                  <button onClick={() => onSelect(selected.filter((id) => id !== e.p.id))} aria-label={`Remove ${e.p.shortName} from comparison`}
                    className="absolute top-1 right-1 w-7 h-7 rounded-full bg-white/95 shadow-sm text-[15px] leading-none">×</button>
                )}
              </div>
              <Link href={`/p/${e.p.id}`} className="block text-[12px] font-semibold leading-tight mt-1.5 line-clamp-2">{e.p.shortName}</Link>
              <ul className="mt-1.5 space-y-1">
                {labels.map((l) => (
                  <li key={l.text} className={`text-[11px] leading-tight rounded px-1.5 py-0.5 ${l.tone === "good" ? "bg-[#E8F5EC] text-[#1b5e2f]" : l.tone === "bad" ? "bg-[#FDECEA] text-[#9b1c13]" : "bg-[#F0F0F3] text-[#444]"}`}>{l.text}</li>
                ))}
              </ul>
              {!e.eligible && firstAlt && (
                <button onClick={() => onSelect(selected.map((id) => (id === e.p.id ? firstAlt.p.id : id)))}
                  className="mt-1.5 text-[11px] font-semibold text-brand underline text-left min-h-[28px]">Swap for {firstAlt.p.shortName}</button>
              )}
            </div>
          );
        })}
        {rows.map((r) => (
          <div key={r.label} className="contents">
            <div className="text-[11px] font-semibold p-2 border-t border-line bg-[#FAFAFA] break-words hyphens-auto">{r.label}</div>
            {r.cells.map((c, i) => (
              <div key={i} className={`text-[12px] p-2 border-t border-l border-line break-words hyphens-auto ${c.tone === "good" ? "text-[#1b5e2f]" : c.tone === "bad" ? "text-[#9b1c13]" : c.tone === "muted" ? "text-[#8a8a8a]" : ""}`}>{c.text}</div>
            ))}
          </div>
        ))}
      </div>
      {result.alternatives.length > 0 && n < 3 && (
        <div className="px-3 py-2.5 border-t border-line">
          <p className="text-[12px] text-muted mb-1.5">Also fits your must-haves:</p>
          <div className="flex flex-wrap gap-1.5">
            {result.alternatives.slice(0, 3).map((e) => (
              <button key={e.p.id} onClick={() => onSelect([...selected, e.p.id])} className="rounded-full border border-brand text-brand text-[12px] px-3 min-h-[32px]">
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
          className={`rounded-full text-[13px] px-3.5 min-h-[36px] border ${value === o.id ? "bg-brand border-brand text-white font-semibold" : "border-[#c9c9cf] text-[#222] bg-white"}`}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

const NONE = "__none";
const critOptions = (c: Criterion) => [...c.options.map((o) => ({ id: o.id, label: o.label })), { id: NONE, label: c.noneLabel }];
/** "" = never answered: no option is shown as selected */
const critValue = (b: Brief, c: Criterion) => (b.values[c.id] === undefined ? "" : b.values[c.id] === null ? NONE : b.values[c.id]!);

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
        <label htmlFor={id} className="text-[13px] font-semibold">Budget (must-have)</label>
        <output htmlFor={id} className="text-[15px] font-bold text-brand">{brief.budget === null && draft === range.max ? "No limit" : `Up to ${inr(draft)}`}</output>
      </div>
      <input id={id} type="range" min={range.min} max={range.max} step={range.step} value={draft}
        onChange={(e) => commitSoon(Number(e.target.value))}
        className="w-full accent-[#3643ba] h-8" aria-valuetext={inr(draft)} />
      <div className="flex justify-between text-[11px] text-muted">
        <span>{inr(range.min)}</span>
        {brief.budget !== null && <button onClick={() => onCommit({ budget: null })} className="text-brand font-semibold min-h-[28px]">Remove limit</button>}
        <span>{inr(range.max)}</span>
      </div>
    </div>
  );
}

function WhatIf({ brief, onCommit, change, canUndo, onUndo }: { brief: Brief; onCommit: Props["onCommit"]; change: Session["change"]; canUndo: boolean; onUndo: () => void }) {
  const profile = PROFILES[brief.profile];
  return (
    <div className="border border-line rounded-2xl bg-white px-4 py-3.5">
      <h3 className="font-bold text-[15px]">What changes if…?</h3>
      <p className="text-[12px] text-muted mb-3">Try a change. The brief, ranking and comparison above update together, and you can undo.</p>
      {change && (
        // the effect, next to the control that caused it (the full note is above the recommendation)
        <div key={change.n} aria-hidden className="adv-in flex items-start gap-2 bg-brand-soft/60 rounded-xl px-3 py-2 mb-3">
          <p className="text-[13px] leading-snug flex-1">{change.effect}</p>
          {canUndo && <button tabIndex={-1} onClick={onUndo} className="text-brand font-semibold text-[13px] min-h-[32px] shrink-0">Undo</button>}
        </div>
      )}
      <div className="space-y-4">
        {profile.controls.map((ctl) => {
          if (ctl.kind === "budget") return <BudgetControl key="budget" brief={brief} onCommit={onCommit} />;
          if (ctl.kind === "priority")
            return (
              <div key="priority">
                <p className="text-[13px] font-semibold mb-1.5">Prioritise</p>
                <Segmented label="Prioritise" options={profile.priorities} value={brief.priority} onChange={(id) => onCommit({ priority: id })} />
              </div>
            );
          const c = criterion(profile, ctl.id)!;
          return (
            <div key={c.id}>
              <p className="text-[13px] font-semibold mb-1.5">{c.label}{c.informational ? "" : brief.must[c.id] ? " (must-have)" : " (preference)"}</p>
              <Segmented label={c.label} options={critOptions(c)} value={critValue(brief, c)} onChange={(id) => onCommit({ values: { [c.id]: id === NONE ? null : id } })} />
            </div>
          );
        })}
      </div>
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
        <p className="text-[12px] text-muted mt-2">Your budget is a must-have: products above it are marked, never silently included.</p>
      </>
    );
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
        <Segmented label={c.label} options={critOptions(c)} value={critValue(brief, c)} onChange={(id) => onCommit({ values: { [c.id]: id === NONE ? null : id } })} />
        {c.canBeMust && brief.values[c.id] && (
          <div className="mt-4">
            <p className="text-[13px] font-semibold mb-1.5">How strict?</p>
            <Segmented label={`${c.label}: must-have or preference`} options={[{ id: "pref", label: "Preference (rank higher)" }, { id: "must", label: "Must-have (filter)" }]}
              value={brief.must[c.id] ? "must" : "pref"} onChange={(id) => onCommit({ must: { [c.id]: id === "must" } })} />
          </div>
        )}
        {c.informational && <p className="text-[12px] text-muted mt-2">Recorded in your brief{c.implies ? "; it sets a suggested minimum capacity you can change" : ""}.</p>}
        {!c.informational && <p className="text-[12px] text-muted mt-2">Currently: {optionLabel(c, brief.values[c.id])}. Products that don&apos;t list this are shown as “Not specified”.</p>}
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
