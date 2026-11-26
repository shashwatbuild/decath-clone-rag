"use client";
import Link from "next/link";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { TopBar } from "@/components/ui";
import { products, getProduct, inr } from "@/lib/products";
import { GOALS, type Goal } from "@/lib/plan";
import { PROFILES } from "@/lib/advisor/profiles";
import { PROFILE, parseLabInput } from "@/lib/lab/input";
import { useLab } from "@/lib/lab/store";
import type { LabInput, LabResult, OwnedGear, GearLog, ScenarioLine } from "@/lib/lab/types";
import LabProduct from "./LabProduct";

const TABS = [
  ["future", "Future self", "01"], ["rehearsal", "Rehearsal", "02"], ["experiments", "Narrow your choices", "03"], ["gear", "My gear", "04"],
  ["community", "Community", "05"], ["evidence", "Why these picks", "06"], ["team", "Team kit", "07"], ["advocate", "Buy less", "08"],
] as const;
type Tab = typeof TABS[number][0];
const validTab = (s: string | null): Tab => TABS.some(t => t[0] === s) ? s as Tab : "future";
const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
function Panel({ title, hint, children, className = "" }: { title: string; hint?: string; children: ReactNode; className?: string }) {
  return <section className={`lab-panel ${className}`}><h2 className="text-[18px] font-semibold tracking-tight">{title}</h2>{hint && <p className="mt-1 text-[13px] leading-relaxed text-muted">{hint}</p>}<div className="mt-5">{children}</div></section>;
}
function Stat({ label, value }: { label: string; value: ReactNode }) { return <div className="rounded-xl bg-[#f7f8fa] p-4"><p className="text-[12px] text-muted">{label}</p><p className="mt-1 text-[21px] font-semibold tracking-tight tabular-nums">{value}</p></div>; }
function Scenario({ title, lines, busy }: { title: string; lines: ScenarioLine[]; busy: boolean }) {
  return <Panel title={title}><div className="space-y-3">{lines.map(l => <div key={l.category}><p className="mb-2 text-[12px] font-semibold text-muted">{l.label}</p>{l.product ? <LabProduct product={l.product} owned={l.owned} disabled={busy} /> : <p className="lab-notice">Not covered · {l.reason}</p>}<p className="mt-2 text-[12px] text-muted">{l.reason}</p></div>)}</div></Panel>;
}

export default function GearLab() {
  const { state, setState, ready, storageError, reset } = useLab();
  const params = useSearchParams(); const router = useRouter();
  const tab = validTab(params.get("tab"));
  const [result, setResult] = useState<LabResult | null>(null);
  const [analyzedState, setAnalyzedState] = useState<LabInput | null>(null);
  const [busy, setBusy] = useState(true); const [error, setError] = useState<string | null>(null); const [retry, setRetry] = useState(0);
  const [resetting, setResetting] = useState(false);
  const [briefOpen, setBriefOpen] = useState(false);
  const importRef = useRef<HTMLInputElement>(null);
  const addedFromLink = useRef<string | null>(null);
  const update = (patch: Partial<LabInput>) => setState(s => ({ ...s, ...patch }));
  useEffect(() => {
    if (!ready) return;
    const productId = params.get("product");
    if (!productId || addedFromLink.current === productId || !getProduct(productId)) return;
    addedFromLink.current = productId;
    setState(s => s.gear.some(g => g.productId === productId) ? s : { ...s, gear: [...s.gear, { id: crypto.randomUUID(), productId, condition: "good", size: "", logs: [] }] });
  }, [params, ready, setState]);
  useEffect(() => {
    if (!ready) return;
    const abort = new AbortController(); let active = true;
    setBusy(true); setError(null);
    const timer = setTimeout(async () => {
      try {
        const response = await fetch("/api/lab", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(state), signal: abort.signal });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Could not refresh the Lab.");
        if (active) { setResult(data); setAnalyzedState(state); }
      } catch (e) { if (active && !abort.signal.aborted) setError(e instanceof Error ? e.message : "Could not refresh the Lab."); }
      finally { if (active) setBusy(false); }
    }, 250);
    return () => { active = false; clearTimeout(timer); abort.abort(); };
  }, [state, ready, retry]);
  const outdated = busy || !!error || analyzedState !== state;
  function exportState() {
    const url = URL.createObjectURL(new Blob([JSON.stringify({ version: 1, state }, null, 2)], { type: "application/json" }));
    const a = document.createElement("a"); a.href = url; a.download = "my-gear-lab.json"; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return <main className="min-h-[var(--app-h)] bg-[#f7f8fa] pb-12">
    <TopBar title="Gear lab" />
    <div className="px-4 pt-5 lg:pt-3">
      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <p className="max-w-2xl text-[14px] leading-relaxed text-muted">Plan around your goals, budget and the gear you own.</p>
        <details className="lab-settings"><summary>Saved plan</summary><div className="flex flex-wrap gap-2 mt-3"><button className="lab-button" onClick={exportState} disabled={!ready}>Export</button><button className="lab-button" onClick={() => importRef.current?.click()}>Import</button><button className="lab-button" onClick={() => setResetting(!resetting)}>Reset</button></div></details>
      </div>
      <input ref={importRef} className="hidden" aria-label="Import Gear Lab JSON" type="file" accept="application/json,.json" onChange={async e => {
        const file = e.target.files?.[0]; if (!file) return;
        try { if (file.size > 100000) throw new Error("Import must be under 100 KB."); const data = JSON.parse(await file.text()); setState(parseLabInput(data.state ?? data)); }
        catch (e) { setError(e instanceof Error ? e.message : "Invalid Lab file."); }
        e.target.value = "";
      }} />
      {resetting && <div className="lab-notice mb-4"><p>Reset this device’s brief, gear and team? Shared feedback has a separate delete control in Community.</p><button className="lab-button mt-3" onClick={() => { reset(); setResetting(false); }}>Reset device Lab</button></div>}
      {storageError && <p role="status" className="lab-notice mb-4">{storageError}</p>}
      <div className="lg:grid lg:grid-cols-[268px_minmax(0,1fr)] gap-6 items-start">
        <aside className="lab-panel lg:sticky lg:top-44">
          <div className="flex items-center justify-between gap-3"><h2 className="font-semibold">Your plan</h2><button className="text-[13px] text-brand font-semibold min-h-10 lg:hidden" aria-expanded={briefOpen} onClick={() => setBriefOpen(!briefOpen)}>{briefOpen ? "Done" : "Edit plan"}</button></div><p className="mt-1 text-[12px] text-muted">{GOALS[state.goal].label === "Marathon" ? "Running" : GOALS[state.goal].label} · {inr(state.budget)} · {state.level}</p>
          <div className={`${briefOpen ? "" : "hidden"} lg:block mt-5 space-y-4`}>
            <label className="lab-label">Activity<select className="lab-input" value={state.goal} onChange={e => update({ goal: e.target.value as Goal, answers: {}, query: `Help me choose ${e.target.value} gear` })}>{Object.entries(GOALS).map(([id, g]) => <option key={id} value={id}>{g.label === "Marathon" ? "Running" : g.label}</option>)}</select></label>
            <label className="lab-label">Budget for new gear (₹)<input className="lab-input" type="number" min="0" max="1000000" step="100" value={state.budget} onChange={e => update({ budget: Math.max(0, Math.min(1000000, Number(e.target.value) || 0)) })} /></label>
            <label className="lab-label">Experience<select className="lab-input" value={state.level} onChange={e => update({ level: e.target.value })}>{["beginner", "intermediate", "advanced"].map(v => <option key={v} value={v}>{v[0].toUpperCase() + v.slice(1)}</option>)}</select></label>
            <label className="lab-label">Prioritise<select className="lab-input" value={state.priority} onChange={e => update({ priority: e.target.value as LabInput["priority"] })}><option value="match">Best match</option><option value="price">Lowest price</option><option value="weight">Lightest</option></select></label>
            <label className="lab-label">What matters to you?<textarea className="lab-input min-h-20 resize-y" value={state.query} maxLength={500} onChange={e => update({ query: e.target.value })} /></label>
            <p className="text-[12px] text-muted">Tell us what matters. Choose specific preferences in “Narrow your choices”.</p>
            <div className="border-t border-line pt-4"><p className="text-[12px] text-muted">Saved in this browser. Export a copy from “Saved plan”.</p></div>
          </div>
        </aside>
        <div className="min-w-0 mt-5 lg:mt-0">
          <label className="lab-tab-select lab-label">Explore<select className="lab-input" value={tab} onChange={e => router.push(`/lab?tab=${e.target.value}`)}>{TABS.map(([id,label]) => <option key={id} value={id}>{label}</option>)}</select></label><nav aria-label="Gear lab sections" className="lab-tabs">{TABS.map(([id, label]) => <Link key={id} href={`/lab?tab=${id}`} aria-current={tab === id ? "page" : undefined} className={`lab-tab ${tab === id ? "lab-tab-active" : ""}`}>{label}</Link>)}</nav>
          <div aria-live="polite" className="min-h-8 py-2 text-[12px] text-muted">{busy ? "Updating your plan…" : error ? "Please retry to update your plan" : ""}</div>
          {error && <div role="alert" className="lab-notice mb-4">{error}<button className="lab-button ml-3" onClick={() => setRetry(n => n + 1)}>Retry</button></div>}
          {!result ? <Panel title="Preparing your Lab"><p className="text-sm text-muted">Finding options for your plan…</p></Panel> : <div aria-busy={busy} className="space-y-5">
            {tab === "future" && <>
              <Panel title="Meet your possible future" hint="Explore a planning scenario, not a prediction of your body or performance.">
                <div className="grid sm:grid-cols-2 gap-4"><label className="lab-label">Scenario<select className="lab-input" value={state.stage} onChange={e => update({ stage: e.target.value as LabInput["stage"] })}><option value="start">Getting started</option><option value="progress">Building a routine</option><option value="challenge">A bigger challenge</option></select></label><label className="lab-label">Planning horizon (weeks)<input className="lab-input" type="number" min="1" max="52" value={state.weeks} onChange={e => update({ weeks: Math.max(1, Math.min(52, Number(e.target.value) || 1)) })} /></label></div>
                <div className="lab-stats grid grid-cols-3 gap-2 mt-5"><Stat label="Starting gear" value={inr(result.future.currentCost)} /><Stat label="Scenario gear" value={inr(result.future.nextCost)} /><Stat label="Difference" value={`${result.future.delta >= 0 ? "+" : "−"}${inr(Math.abs(result.future.delta))}`} /></div>
                <details className="mt-4 text-[13px] text-muted"><summary>Planning assumptions</summary><ul className="list-disc pl-5 mt-3 space-y-2">{result.future.assumptions.map(a => <li key={a}>{a}</li>)}</ul></details>
              </Panel>
              <div className="grid xl:grid-cols-2 gap-5"><Scenario title="Start with the essentials" lines={result.future.current} busy={outdated} /><Scenario title="Your chosen scenario" lines={result.future.next} busy={outdated} /></div>
            </>}
            {tab === "rehearsal" && <Panel title="Rehearse the conditions" hint="A catalogue-based checklist. Conditions are assumptions you choose, not live weather or a safety assessment.">
              <div className="flex flex-wrap gap-3 mb-5">{([["rain", "Rain expected"], ["outdoor", "Outdoor session"], ["longSession", "Longer session"]] as const).map(([key, label]) => <label key={key} className="lab-check"><input type="checkbox" checked={state[key]} onChange={e => update({ [key]: e.target.checked })} />{label}</label>)}</div>
              <div className="space-y-3">{result.rehearsal.map(r => <div key={r.title} className="rounded-xl border border-line p-4"><span className="lab-badge">{r.status === "ready" ? "Listed evidence" : r.status === "unknown" ? "Unknown" : "Check before going"}</span><h3 className="font-semibold text-[15px] mt-3">{r.title}</h3><p className="mt-2 text-[13px] text-muted">{r.detail}</p><div className="flex gap-3 mt-3">{r.sourceIds.map((url, i) => <Link key={url} className="text-[12px] text-brand underline" href={url}>Evidence {i + 1}</Link>)}</div></div>)}</div>
            </Panel>}
            {tab === "experiments" && <Panel title="One useful check beats ten guesses" hint="Choose what matters to you to narrow the options.">
              {result.experiment ? <><span className="lab-badge">{result.experiment.before} options</span><h3 className="font-semibold mt-4">{result.experiment.label}</h3><div className="flex flex-wrap gap-2 mt-4">{result.experiment.options.map(o => <button className="lab-button" disabled={busy} key={o.id} onClick={() => update({ answers: { ...state.answers, [result.experiment!.id]: o.id } })}>{o.label} · {o.count} matches</button>)}</div></> : <p className="text-[14px] text-muted">{result.candidates.some(c => c.eligible) ? "No additional listed field usefully separates the current options. Try a measurement or review the evidence." : "No current match. Adjust the budget or remove a requirement to explore options."}</p>}
              {Object.keys(state.answers).length > 0 && <div className="mt-5 space-y-2">{Object.entries(state.answers).map(([key, value]) => <div key={key} className="flex justify-between items-center gap-3 rounded-xl bg-[#f7f8fa] p-3 text-[13px]"><span>{PROFILES[PROFILE[state.goal]].criteria.find(c => c.id === key)?.label}: {PROFILES[PROFILE[state.goal]].criteria.find(c => c.id === key)?.options.find(o => o.id === value)?.label}</span><button className="text-brand min-h-10" onClick={() => { const answers = { ...state.answers }; delete answers[key]; update({ answers }); }}>Remove</button></div>)}</div>}
              {state.goal === "running" && <div className="mt-6 border-t border-line pt-5"><label className="lab-label">Measure your longer foot (cm)<input type="number" min="18" max="34" step="0.1" className="lab-input max-w-48" placeholder="e.g. 26" value={state.footCm ?? ""} onChange={e => update({ footCm: e.target.value ? Math.max(18, Math.min(34, Number(e.target.value))) : null })} /></label><p className="text-[12px] text-muted mt-2">Use the product’s size chart to confirm your size.</p>{state.footCm && <p className="mt-3 text-[14px]">Starting size estimate: EU {Math.round((state.footCm + 1.5) * 1.5)}. Only choose a size actually listed on the product page.</p>}</div>}
              <Link className="lab-button mt-5 inline-flex" href="/lab?tab=evidence">See what this changes →</Link>
            </Panel>}
            {tab === "gear" && <GearInventory result={result} />}
            {tab === "community" && <Community />}
            {tab === "evidence" && <>
              <Panel title="Why these picks" hint="See how each product matches your budget and chosen preferences."><p className="text-[14px] leading-relaxed">{result.candidates.some(c => c.eligible) ? "Check the details below before choosing. Anything the catalogue does not confirm is marked unknown." : "No product matches all your choices. Try changing your budget or removing a preference."}</p></Panel>
              {result.candidates.map(c => <Panel key={c.product.id} title={c.eligible ? "Matches your choices" : "Check before choosing"}>
                <LabProduct product={c.product} disabled={outdated || !c.eligible} />
                <div className="overflow-x-auto mt-4"><table className="lab-table evidence-table"><thead><tr><th>Requirement</th><th>Result</th><th>Catalogue evidence</th></tr></thead><tbody>{c.checks.map(ch => <tr key={ch.id}><td data-label="Preference">{ch.label}<span className="block text-[11px] text-muted">{ch.wanted}{ch.must ? " · Required" : " · Preference"}</span></td><td data-label="Match">{ch.status === "match" ? "Meets" : ch.status === "unknown" ? "Unknown" : "Does not meet"}</td><td data-label="Product details">{ch.evidence ? <Link className="text-brand underline" href={`/p/${c.product.id}`}>{ch.evidence.field}: {ch.evidence.value}</Link> : "Not specified"}</td></tr>)}</tbody></table></div>
                <p className="text-[12px] text-muted mt-3">Confirm your size and suitability on the product page.</p>
              </Panel>)}
            </>}
            {tab === "team" && <Panel title="One team. Fewer duplicate purchases." hint="Individual budgets stay separate. Personal shoes, clothing and rackets are never shared; a badminton shuttle set can be shared.">
              <div className="space-y-3">{state.members.map(m => <div className="rounded-xl border border-line p-4" key={m.id}><div className="grid sm:grid-cols-2 gap-3"><label className="lab-label">Name<input className="lab-input" maxLength={40} value={m.name} onChange={e => update({ members: state.members.map(x => x.id === m.id ? { ...x, name: e.target.value } : x) })} /></label><label className="lab-label">New-gear budget (₹)<input className="lab-input" type="number" min="0" max="1000000" value={m.budget} onChange={e => update({ members: state.members.map(x => x.id === m.id ? { ...x, budget: Math.max(0, Math.min(1000000, Number(e.target.value) || 0)) } : x) })} /></label></div><label className="lab-label mt-3">Already owns<select className="lab-input" value="" onChange={e => { if (e.target.value) update({ members: state.members.map(x => x.id === m.id ? { ...x, ownedIds: [...new Set([...x.ownedIds, e.target.value])] } : x) }); }}><option value="">Add an owned item…</option>{products.filter(p => p.sport.toLowerCase() === state.goal || GOALS[state.goal].needs.some(n => n.category === p.category)).map(p => <option key={p.id} value={p.id}>{p.shortName}</option>)}</select></label><div className="flex flex-wrap gap-2 mt-2">{m.ownedIds.map(id => <button className="lab-button text-[12px]" key={id} onClick={() => update({ members: state.members.map(x => x.id === m.id ? { ...x, ownedIds: x.ownedIds.filter(p => p !== id) } : x) })}>{getProduct(id)?.shortName} ×</button>)}</div>{state.members.length > 1 && <button className="text-[12px] text-brand mt-3" onClick={() => update({ members: state.members.filter(x => x.id !== m.id) })}>Remove teammate</button>}</div>)}</div>
              <button className="lab-button mt-3" disabled={state.members.length >= 6} onClick={() => update({ members: [...state.members, { id: crypto.randomUUID(), name: `Teammate ${state.members.length + 1}`, budget: 3000, ownedIds: [] }] })}>Add teammate</button>
              <div className="grid sm:grid-cols-2 gap-3 mt-5"><Stat label="Uncovered needs" value={result.team.uncovered} /><Stat label="Duplicate spend avoided by sharing" value={inr(result.team.savedBySharing)} /></div>
              {result.team.totals.map(t => <div key={t.memberId} className="mt-5"><h3 className="font-semibold">{state.members.find(m => m.id === t.memberId)?.name} · {inr(t.spent)} new gear</h3><p className="text-[12px] text-muted mb-3">{inr(t.remaining)} remaining. Confirm individual size and suitability.</p><div className="space-y-3">{result.team.lines.filter(l => l.memberId === t.memberId).map((l, i) => <div key={l.category + i}><p className="text-[12px] text-muted mb-1">{l.category}{l.shared ? " · Shared once" : ""}</p>{l.product ? <LabProduct product={l.product} owned={l.owned} disabled={outdated} addFor={state.members.find(m => m.id === t.memberId)?.name ?? "teammate"} /> : <p className="lab-notice">{l.reason}</p>}</div>)}</div></div>)}
            </Panel>}
            {tab === "advocate" && <Panel title="The best purchase may be no purchase" hint="Start with what you own. Borrowing, rental and repair are suggestions to investigate, not verified services."><div className="space-y-3">{result.advocate.map(a => <div key={a.category} className="rounded-xl border border-line p-4"><span className="lab-badge">{a.action === "reuse" ? "Reuse first" : a.action === "maintain" ? "Repair before replacing" : a.action === "inspect" ? "Inspect first" : a.action === "defer" ? "Optional · defer" : "Check borrowing or rental"}</span><h3 className="font-semibold mt-3">{a.category}</h3><p className="text-[13px] text-muted mt-2">{a.detail}</p>{a.product && <Link href={`/p/${a.product.id}`} className="inline-block mt-3 text-[13px] text-brand underline">{a.product.shortName} · view evidence</Link>}</div>)}</div><button className="lab-button mt-4" onClick={() => router.push("/lab?tab=gear")}>Update what I own →</button></Panel>}
            <details className="lab-panel"><summary className="font-semibold text-[14px]">Sources</summary><div className="mt-4 space-y-3">{result.sources.map(source => <div key={source.id} className="border-t border-line pt-3"><Link href={source.url} className="text-[13px] font-semibold text-brand">{source.title}</Link><p className="text-[13px] text-muted mt-1">{source.snippet}</p><details className="mt-2 text-[12px] text-muted"><summary>Read more</summary><p className="mt-2 whitespace-pre-line">{source.text}</p></details></div>)}</div></details>
          </div>}
        </div>
      </div>
    </div>
  </main>;
}

function GearInventory({ result }: { result: LabResult }) {
  const { state, setState } = useLab(); const [productId, setProductId] = useState("");
  const updateGear = (id: string, patch: Partial<OwnedGear>) => setState(s => ({ ...s, gear: s.gear.map(g => g.id === id ? { ...g, ...patch } : g) }));
  return <Panel title="Gear that remembers its life" hint="Your own observations, stored on this device. Logs cannot establish internal damage or predict remaining useful life.">
    <div className="flex flex-wrap gap-2"><select className="lab-input flex-1 min-w-0" aria-label="Owned product" value={productId} onChange={e => setProductId(e.target.value)}><option value="">Choose gear you own…</option>{products.filter(p => !state.gear.some(g => g.productId === p.id)).map(p => <option key={p.id} value={p.id}>{p.shortName}</option>)}</select><button className="lab-button lab-button-primary" disabled={!productId || state.gear.length >= 40} onClick={() => { setState(s => ({ ...s, gear: [...s.gear, { id: crypto.randomUUID(), productId, condition: "good", size: "", logs: [] }] })); setProductId(""); }}>Add owned gear</button></div>
    {!state.gear.length && <p className="lab-notice mt-5">Your inventory is empty. Add something you already own to improve scenarios, team planning and buy-less advice.</p>}
    <div className="space-y-4 mt-5">{state.gear.map(g => <GearItem key={g.id} gear={g} insight={result.lifecycle.find(l => l.gearId === g.id)} update={patch => updateGear(g.id, patch)} remove={() => setState(s => ({ ...s, gear: s.gear.filter(x => x.id !== g.id) }))} />)}</div>
  </Panel>;
}
function GearItem({ gear: g, insight, update, remove }: { gear: OwnedGear; insight?: LabResult["lifecycle"][number]; update: (patch: Partial<OwnedGear>) => void; remove: () => void }) {
  const [kind, setKind] = useState<GearLog["kind"]>("use"); const [note, setNote] = useState(""); const [minutes, setMinutes] = useState(30);
  const p = getProduct(g.productId)!;
  return <div className="rounded-2xl border border-line p-4"><div className="flex justify-between gap-3"><Link className="font-semibold text-[15px]" href={`/p/${p.id}`}>{p.shortName}</Link><button className="text-[12px] text-brand" onClick={remove}>Remove</button></div>
    <div className="grid sm:grid-cols-2 gap-3 mt-4"><label className="lab-label">Reported condition<select className="lab-input" value={g.condition} onChange={e => update({ condition: e.target.value as OwnedGear["condition"] })}><option value="good">Usable</option><option value="worn">Worn · needs inspection</option><option value="repair">Needs repair · do not count for reuse</option></select></label><label className="lab-label">Your size<select className="lab-input" value={g.size} onChange={e => update({ size: e.target.value })}><option value="">Not recorded</option>{p.sizes.map(s => <option key={s}>{s}</option>)}</select></label></div>
    <p className="text-[13px] text-muted mt-4">{insight ? `${insight.uses} logged uses · ${insight.minutes} minutes. ${insight.advice}` : "Refreshing care guidance…"}</p>
    <details className="mt-4"><summary className="text-[13px] font-semibold text-brand">Usage, repairs & comfort</summary><div className="mt-3 flex flex-wrap gap-2"><select aria-label={`Log type for ${p.shortName}`} className="lab-input" value={kind} onChange={e => setKind(e.target.value as GearLog["kind"])}><option value="use">Use</option><option value="repair">Repair</option><option value="comfort">Comfort feedback</option></select>{kind === "use" && <input className="lab-input max-w-32" aria-label={`Minutes for ${p.shortName}`} type="number" min="1" max="1440" value={minutes} onChange={e => setMinutes(Math.max(1, Math.min(1440, Number(e.target.value) || 1)))} />}<input className="lab-input flex-1 min-w-36" aria-label={`Note for ${p.shortName}`} maxLength={300} placeholder="Your observation" value={note} onChange={e => setNote(e.target.value)} /><button className="lab-button" disabled={g.logs.length >= 100 || (kind !== "use" && !note.trim())} onClick={() => { update({ logs: [...g.logs, { id: crypto.randomUUID(), date: today(), kind, note: note.trim(), minutes: kind === "use" ? minutes : 0 }] }); setNote(""); }}>Save log</button></div>{g.logs.length === 0 && <p className="text-[12px] text-muted mt-3">No logs yet.</p>}<ul className="mt-3 space-y-2">{g.logs.slice().reverse().map(l => <li key={l.id} className="rounded-lg bg-[#f7f8fa] p-3 text-[12px]"><span className="font-semibold">{l.date} · {l.kind}{l.minutes ? ` · ${l.minutes} min` : ""}</span><p className="mt-1 text-muted">{l.note}</p><button className="text-brand mt-2" onClick={() => update({ logs: g.logs.filter(x => x.id !== l.id) })}>Delete log</button></li>)}</ul></details>
  </div>;
}

type CommunityData = { minimum: number; groups: { productId: string; size: string; participants: number; small: number; right: number; large: number }[] };
function Community() {
  const [data, setData] = useState<CommunityData | null>(null); const [productId, setProductId] = useState(products[0].id); const [size, setSize] = useState(""); const [fit, setFit] = useState("right"); const [consent, setConsent] = useState(false); const [status, setStatus] = useState(""); const [busy, setBusy] = useState(false);
  const p = getProduct(productId)!;
  async function refresh() { try { const r = await fetch("/api/lab/community", { cache: "no-store" }); const d = await r.json(); if (!r.ok) throw new Error(d.error); setData(d); } catch (e) { setStatus(e instanceof Error ? e.message : "Community is unavailable."); } }
  useEffect(() => { void refresh(); }, []);
  async function submit(remove: boolean) {
    setBusy(true); setStatus("");
    try {
      let token = localStorage.getItem("dc.community-token");
      if (!token) { if (remove) { setStatus("No contribution token is saved on this device."); return; } token = crypto.randomUUID(); localStorage.setItem("dc.community-token", token); }
      const r = await fetch("/api/lab/community", { method: remove ? "DELETE" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token, productId, size: p.sizes.length === 1 ? p.sizes[0] : !p.sizes.length ? "One size" : size, fit, consent }) });
      const d = await r.json(); if (!r.ok) throw new Error(d.error);
      setStatus(remove ? "Your device’s shared reports were deleted." : "Report saved. It appears publicly only when its size group reaches the minimum.");
      if (remove) localStorage.removeItem("dc.community-token");
      setConsent(false); await refresh();
    } catch (e) { setStatus(e instanceof Error ? e.message : "Could not save feedback."); }
    finally { setBusy(false); }
  }
  return <Panel title="Learn from real fit experiences" hint="Share how a size felt. Results appear after at least five devices contribute; reports are not verified purchases.">
    <div className="grid sm:grid-cols-2 gap-3"><label className="lab-label">Product<select className="lab-input" value={productId} onChange={e => { setProductId(e.target.value); setSize(""); }}>{products.filter(p => p.sizes.length > 1).map(p => <option key={p.id} value={p.id}>{p.shortName}</option>)}</select></label><label className="lab-label">Size tried<select className="lab-input" value={size} onChange={e => setSize(e.target.value)}><option value="">Choose size</option>{p.sizes.map(s => <option key={s}>{s}</option>)}</select></label></div>
    <label className="lab-label mt-4">How did it feel?<select className="lab-input" value={fit} onChange={e => setFit(e.target.value)}><option value="small">Smaller than expected</option><option value="right">As expected</option><option value="large">Larger than expected</option></select></label>
    <label className="lab-check mt-4"><input type="checkbox" checked={consent} onChange={e => setConsent(e.target.checked)} />Share this product, size and fit report with this app’s community.</label><p className="text-[12px] text-muted mt-2">No name or photo is shared. Your feedback is kept for up to 180 days. Use this browser to delete it.</p>
    <div className="flex flex-wrap gap-2 mt-4"><button className="lab-button lab-button-primary" disabled={busy || !consent || !size} onClick={() => submit(false)}>Share fit report</button><button className="lab-button" disabled={busy} onClick={() => submit(true)}>Delete my shared reports</button><button className="lab-button" disabled={busy} onClick={refresh}>Refresh groups</button></div>
    {status && <p role="status" className="lab-notice mt-4">{status}</p>}
    <div className="mt-6"><h3 className="font-semibold">Published fit groups</h3>{!data ? <p className="text-[13px] text-muted mt-3">Loading community data…</p> : !data.groups.length ? <p className="lab-notice mt-3">No group has reached {data.minimum} contributions yet. No community fit claim is made.</p> : <div className="overflow-x-auto mt-3"><table className="lab-table"><thead><tr><th>Product / size</th><th>Devices</th><th>Small</th><th>As expected</th><th>Large</th></tr></thead><tbody>{data.groups.map(g => <tr key={g.productId + g.size}><td><Link className="text-brand" href={`/p/${g.productId}`}>{getProduct(g.productId)?.shortName}</Link><span className="block text-muted">{g.size}</span></td><td>{g.participants}</td><td>{g.small}</td><td>{g.right}</td><td>{g.large}</td></tr>)}</tbody></table></div>}</div>
  </Panel>;
}
