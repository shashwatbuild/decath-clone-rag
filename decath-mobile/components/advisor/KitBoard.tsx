"use client";

/**
 * Activity kit board: Covered / To choose / Selected / Optional. Owned and skipped items never count
 * towards purchases; only selected new items (with sizes chosen) can be added to the cart.
 */
import Link from "next/link";
import { useEffect, useState } from "react";
import { img, inr } from "@/lib/products";
import type { CartItem } from "@/lib/types";
import type { Brief } from "@/lib/advisor/engine";
import { cheaperSwaps, kitOptions, summarise, whyIncluded, type ItemState, type Kit, type KitItem, type KitLine } from "@/lib/advisor/kit";

type Props = {
  brief: Brief;
  kit: Kit;
  cart: CartItem[];
  onKit: (items: Record<string, Partial<KitItem>>, budget?: number | null) => void;
  onAddToCart: (lines: KitLine[]) => void;
};

const STATES: { id: Exclude<ItemState, null>; label: string }[] = [
  { id: "own", label: "Already own" },
  { id: "need", label: "Need this" },
  { id: "unsure", label: "Not sure" },
  { id: "skip", label: "Skip" },
];

export default function KitBoard({ brief, kit, cart, onKit, onAddToCart }: Props) {
  const sum = summarise(brief, kit, cart);
  const swaps = sum.over ? cheaperSwaps(brief, sum) : [];
  const groups: { title: string; note: string; lines: KitLine[] }[] = [
    { title: "Selected", note: "New products you've chosen", lines: sum.selected },
    { title: "To choose", note: "You need these; pick a product", lines: sum.toChoose },
    { title: "Covered", note: "Already owned: not in purchases or totals", lines: sum.covered },
    { title: "Optional / undecided", note: "Decide if you want these", lines: sum.optional },
    { title: "Skipped", note: "Excluded from suggestions and totals", lines: sum.skipped },
  ];
  return (
    <div className="border border-line rounded-2xl bg-white overflow-hidden">
      <div className="px-4 pt-3.5 pb-3">
        <h3 className="font-bold text-[15px]">Your {brief.profile.startsWith("yoga") ? "yoga" : ""} activity kit</h3>
        <p className="text-[12px] text-muted mt-0.5">What do you already have for this activity? Nothing is added unless you choose it.</p>
      </div>

      <KitTotals sum={sum} kit={kit} onKit={onKit} />

      {sum.allOwned && (
        <p role="status" className="mx-4 mb-3 rounded-xl bg-[#E8F5EC] text-[#1b5e2f] text-[13px] px-3 py-2.5">You have the items selected for this kit. No new purchases needed.</p>
      )}
      {sum.over > 0 && (
        <div role="status" className="mx-4 mb-3 rounded-xl bg-[#FDECEA] px-3 py-2.5 text-[13px]">
          <p className="font-semibold text-[#9b1c13]">{inr(sum.over)} over your kit budget</p>
          <div className="flex flex-wrap gap-1.5 mt-2">
            {swaps.map((sw) => (
              <button key={sw.line.def.id} onClick={() => onKit({ [sw.line.def.id]: { pick: sw.to.id, size: null, carried: false } })} className="rounded-full border border-brand text-brand bg-white text-[12px] px-3 min-h-[32px]">
                Swap to {sw.to.shortName} (−{inr(sw.saves)})
              </button>
            ))}
            {sum.selected.filter((l) => !l.def.essential).map((l) => (
              <button key={l.def.id} onClick={() => onKit({ [l.def.id]: { state: "skip" } })} className="rounded-full border border-brand text-brand bg-white text-[12px] px-3 min-h-[32px]">Remove {l.def.label.toLowerCase()}</button>
            ))}
            <button onClick={() => onKit({}, kit.budget! + sum.over)} className="rounded-full bg-brand text-white text-[12px] font-semibold px-3 min-h-[32px]">Raise kit budget to {inr(kit.budget! + sum.over)}</button>
          </div>
        </div>
      )}

      {groups.filter((g) => g.lines.length).map((g) => (
        <div key={g.title} className="border-t border-line">
          <p className="px-4 pt-2.5 text-[12px] font-bold uppercase tracking-wide text-[#555]">{g.title} <span className="normal-case font-normal tracking-normal text-muted">· {g.note}</span></p>
          <ul>{g.lines.map((l) => <KitRow key={l.def.id} line={l} brief={brief} onKit={onKit} />)}</ul>
        </div>
      ))}

      <div className="border-t border-line px-4 py-3 bg-[#FAFAFB]">
        {sum.missingSizes.length > 0 && <p className="text-[12px] text-[#8a6d00] mb-2">Choose a size for: {sum.missingSizes.map((l) => l.product!.shortName).join(", ")}</p>}
        {sum.selected.some((l) => l.inCart) && <p className="text-[12px] text-muted mb-2">Already in your cart: {sum.selected.filter((l) => l.inCart).map((l) => l.product!.shortName).join(", ")} (won&apos;t be added twice)</p>}
        <button disabled={!sum.readyToAdd.length || sum.missingSizes.length > 0} onClick={() => onAddToCart(sum.readyToAdd)}
          className="w-full rounded-full bg-brand text-white font-semibold text-[14px] min-h-[44px] disabled:bg-[#b9bce0]">
          {sum.readyToAdd.length ? `Add ${sum.readyToAdd.length} new item${sum.readyToAdd.length > 1 ? "s" : ""} to cart · ${inr(sum.readyToAdd.reduce((t, l) => t + l.product!.price, 0))}` : "Add selected items to cart"}
        </button>
        <p className="text-[11px] text-muted mt-1.5 text-center">Only selected new items are added. Owned, skipped and undecided items never are.</p>
      </div>
    </div>
  );
}

function KitTotals({ sum, kit, onKit }: { sum: ReturnType<typeof summarise>; kit: Kit; onKit: Props["onKit"] }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(kit.budget ?? ""));
  useEffect(() => setDraft(String(kit.budget ?? "")), [kit.budget]);
  return (
    <div className="mx-4 mb-3 rounded-xl border border-line px-3 py-2.5">
      <dl className="grid grid-cols-2 gap-y-1 text-[13px]">
        <dt className="text-muted">New items total</dt><dd className="text-right font-bold">{inr(sum.total)}</dd>
        <dt className="text-muted">Kit budget</dt>
        <dd className="text-right">{kit.budget === null ? <span className="text-muted">Not set</span> : inr(kit.budget)}</dd>
        {sum.remaining !== null && <><dt className="text-muted">Remaining</dt><dd className={`text-right font-semibold ${sum.remaining < 0 ? "text-[#9b1c13]" : "text-[#1b5e2f]"}`}>{sum.remaining < 0 ? `−${inr(-sum.remaining)}` : inr(sum.remaining)}</dd></>}
        <dt className="text-muted">Already covered</dt><dd className="text-right">{sum.covered.length} item{sum.covered.length === 1 ? "" : "s"}</dd>
        <dt className="text-muted">Undecided</dt><dd className="text-right">{sum.undecided}</dd>
      </dl>
      <p className="text-[11px] text-muted mt-1.5">Your per-product budget (e.g. for the pants) stays separate from this kit budget.</p>
      {editing ? (
        <form className="flex gap-2 mt-2" onSubmit={(e) => { e.preventDefault(); const n = Number(draft.replace(/[^\d]/g, "")); onKit({}, n > 0 ? n : null); setEditing(false); }}>
          <label className="sr-only" htmlFor="kit-budget">Kit budget in rupees</label>
          <input id="kit-budget" inputMode="numeric" value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="e.g. 2500" className="flex-1 min-w-0 border border-[#ccc] rounded-full px-3 min-h-[38px] text-[14px]" autoFocus />
          <button className="rounded-full bg-brand text-white text-[13px] font-semibold px-4 min-h-[38px]">Set</button>
        </form>
      ) : (
        <div className="flex gap-3 mt-1.5">
          <button onClick={() => setEditing(true)} className="text-brand text-[13px] font-semibold min-h-[32px]">{kit.budget === null ? "Set a kit budget (optional)" : "Change kit budget"}</button>
          {kit.budget !== null && <button onClick={() => onKit({}, null)} className="text-brand text-[13px] min-h-[32px]">Remove</button>}
        </div>
      )}
    </div>
  );
}

function KitRow({ line, brief, onKit }: { line: KitLine; brief: Brief; onKit: Props["onKit"] }) {
  const { def, item, product } = line;
  const [why, setWhy] = useState(false);
  const [comparing, setComparing] = useState(false);
  const options = kitOptions(brief, def);
  const buying = item.state === "need" || (item.state === "unsure" && item.include);
  const set = (p: Partial<KitItem>) => onKit({ [def.id]: p });
  return (
    <li className="px-4 py-3 border-t border-line first:border-t-0">
      <div className="flex items-center gap-2">
        <span className="font-semibold text-[14px] flex-1">{def.label}</span>
        <span className={`text-[11px] font-semibold rounded-full px-2 py-0.5 ${def.essential ? "bg-brand-soft text-brand" : "bg-[#F0F0F3] text-[#555]"}`}>{def.essential ? "Essential" : "Optional"}</span>
      </div>
      <p className="text-[12px] text-muted mt-0.5">{def.basis}</p>
      <div role="radiogroup" aria-label={`${def.label}: do you have it?`} className="flex flex-wrap gap-1.5 mt-2">
        {STATES.map((s) => (
          <button key={s.id} role="radio" aria-checked={item.state === s.id} onClick={() => item.state !== s.id && set({ state: s.id })}
            className={`rounded-full text-[12px] px-3 min-h-[34px] border ${item.state === s.id ? "bg-brand border-brand text-white font-semibold" : "border-[#c9c9cf] bg-white"}`}>{s.label}</button>
        ))}
      </div>

      {item.state === "own" && (
        <div className="mt-2 text-[12px]">
          <p className="text-[#1b5e2f] font-semibold">✓ Already owned · not included in purchases or totals</p>
          <label className="block mt-1.5 text-muted" htmlFor={`own-${def.id}`}>Details (optional)</label>
          <input id={`own-${def.id}`} defaultValue={item.ownNote ?? ""} onBlur={(e) => e.target.value !== (item.ownNote ?? "") && set({ ownNote: e.target.value })} placeholder="e.g. 4 mm mat, two years old" className="w-full border border-[#ddd] rounded-lg px-2.5 min-h-[34px] mt-1" />
        </div>
      )}
      {item.state === "unsure" && (
        <div className="mt-2 text-[12px]">
          <p>{def.whenUseful}</p>
          <button onClick={() => set({ include: !item.include })} className="mt-1.5 rounded-full border border-brand text-brand px-3 min-h-[32px] font-semibold">{item.include ? "Leave it out" : "Include it"}</button>
        </div>
      )}

      {buying && !def.category && <p className="mt-2 text-[12px] text-[#8a6d00]">This demo catalogue doesn&apos;t stock {def.label.toLowerCase()} yet, so there&apos;s nothing to suggest.</p>}

      {buying && def.category && product && (
        <div className="mt-2.5 rounded-xl border border-line p-2.5">
          {item.carried && <p className="text-[11px] font-semibold text-brand mb-1.5">From your {brief.profile === "yoga-pants" ? "pants" : "product"} search (not added twice)</p>}
          <div className="flex gap-2.5 items-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={img(product.images[0], 140)} alt="" className="w-14 h-14 rounded-lg object-cover bg-[#F5F4F5]" />
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-semibold leading-tight">{product.shortName}</p>
              <p className="text-[13px]"><b>{inr(product.price)}</b> <span className="text-[12px] text-muted">{product.reviewCount ? `★ ${product.rating} · ${product.reviewCount}` : "No reviews yet"}</span></p>
              {line.inCart && <p className="text-[11px] text-[#1b5e2f]">Already in your cart</p>}
            </div>
          </div>
          {line.needsSize && (
            <div className="mt-2">
              <p className="text-[12px] font-semibold">Size <Link href={`/p/${product.id}`} className="font-normal text-brand underline ml-1">Size guide</Link></p>
              <div role="radiogroup" aria-label={`Size for ${product.shortName}`} className="flex flex-wrap gap-1.5 mt-1">
                {product.sizes.map((sz) => (
                  <button key={sz} role="radio" aria-checked={item.size === sz} onClick={() => set({ size: sz })}
                    className={`rounded-lg text-[12px] px-2.5 min-h-[32px] border ${item.size === sz ? "bg-brand border-brand text-white font-semibold" : "border-[#c9c9cf] bg-white"}`}>{sz}</button>
                ))}
              </div>
              <p className="text-[11px] text-muted mt-1">Per-size stock isn&apos;t shown in this demo.</p>
            </div>
          )}
          <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2 text-[12px] font-semibold text-brand">
            <Link href={`/p/${product.id}`} className="min-h-[28px] flex items-center">View details</Link>
            <button onClick={() => setComparing((v) => !v)} className="min-h-[28px]">{comparing ? "Hide alternatives" : "Compare alternatives"}</button>
            <button onClick={() => set({ pick: null, size: null, carried: false })} className="min-h-[28px]">Remove</button>
            <button onClick={() => set({ state: "own" })} className="min-h-[28px]">Mark as already owned</button>
            <button onClick={() => setWhy((v) => !v)} aria-expanded={why} className="min-h-[28px]">Why included?</button>
          </div>
          {why && <ul className="mt-1.5 text-[12px] list-disc pl-4 space-y-0.5">{whyIncluded(brief, def, product).map((w) => <li key={w}>{w}</li>)}</ul>}
          {comparing && <Options options={options} current={product.id} onPick={(id) => { set({ pick: id, size: null, carried: false }); setComparing(false); }} />}
        </div>
      )}
      {buying && def.category && !product && (
        <div className="mt-2.5">
          <p className="text-[12px] font-semibold">Suitable options from the catalogue</p>
          {options.length ? <Options options={options} onPick={(id) => set({ pick: id, size: null })} /> : <p className="text-[12px] text-muted">Nothing in the catalogue meets your brief for this item.</p>}
        </div>
      )}
    </li>
  );
}

function Options({ options, current, onPick }: { options: ReturnType<typeof kitOptions>; current?: string; onPick: (id: string) => void }) {
  return (
    <ul className="mt-1.5 space-y-1.5">
      {options.slice(0, 4).map((e) => (
        <li key={e.p.id} className="flex items-center gap-2 text-[12px]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={img(e.p.images[0], 100)} alt="" className="w-10 h-10 rounded object-cover bg-[#F5F4F5]" />
          <span className="flex-1 min-w-0">
            <span className="block font-semibold leading-tight">{e.p.shortName}</span>
            <span className="block text-muted">{inr(e.p.price)}{e.p.reviewCount ? ` · ★ ${e.p.rating} (${e.p.reviewCount})` : ""}{e.checks.filter((c) => c.status === "match").map((c) => ` · ${c.listed}`).join("")}</span>
          </span>
          {e.p.id === current ? <span className="text-[11px] text-muted">Selected</span> : (
            <button onClick={() => onPick(e.p.id)} className="rounded-full border border-brand text-brand px-3 min-h-[32px] font-semibold">{current ? "Swap" : "Select"}</button>
          )}
        </li>
      ))}
    </ul>
  );
}
