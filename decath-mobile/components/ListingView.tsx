"use client";

import { useMemo, useState } from "react";
import type { Product } from "@/lib/types";
import { discountPct, toCard } from "@/lib/products";
import ProductCard from "./ProductCard";
import { BottomSheet, ChatFab, TopBar } from "./ui";
import { CouponBanner } from "./CouponBanner";
import { IconFilter, IconSort, IconUsers } from "./Icons";

const SORTS = {
  relevance: "Relevance",
  priceAsc: "Price (low → high)",
  priceDesc: "Price (high → low)",
  rating: "Customer rating",
  discount: "Discount",
} as const;
type SortKey = keyof typeof SORTS;

const PRICE_BANDS = [
  { label: "Under ₹1,000", min: 0, max: 999 },
  { label: "₹1,000 – ₹4,999", min: 1000, max: 4999 },
  { label: "₹5,000 – ₹14,999", min: 5000, max: 14999 },
  { label: "₹15,000 & above", min: 15000, max: Infinity },
];

export default function ListingView({ title, items, empty }: { title: string; items: Product[]; empty?: React.ReactNode }) {
  const [sort, setSort] = useState<SortKey>("relevance");
  const [minRating, setMinRating] = useState(false);
  const [onlyTag, setOnlyTag] = useState<string | null>(null);
  const [genders, setGenders] = useState<string[]>([]);
  const [brands, setBrands] = useState<string[]>([]);
  const [bands, setBands] = useState<number[]>([]);
  const [sheet, setSheet] = useState<"sort" | "filter" | "gender" | null>(null);

  const allBrands = useMemo(() => [...new Set(items.map((p) => p.brand))].sort(), [items]);
  const allGenders = useMemo(() => [...new Set(items.map((p) => p.gender))].sort(), [items]);
  const tags = useMemo(() => [...new Set(items.map((p) => p.tag).filter(Boolean))] as string[], [items]);

  const shown = useMemo(() => {
    const out = items.filter(
      (p) =>
        (!minRating || p.rating >= 4) &&
        (!onlyTag || p.tag === onlyTag) &&
        (!genders.length || genders.includes(p.gender)) &&
        (!brands.length || brands.includes(p.brand)) &&
        (!bands.length || bands.some((i) => p.price >= PRICE_BANDS[i].min && p.price <= PRICE_BANDS[i].max)),
    );
    const cmp: Record<SortKey, (a: Product, b: Product) => number> = {
      relevance: () => 0,
      priceAsc: (a, b) => a.price - b.price,
      priceDesc: (a, b) => b.price - a.price,
      rating: (a, b) => b.rating - a.rating || b.reviewCount - a.reviewCount,
      discount: (a, b) => discountPct(b) - discountPct(a),
    };
    return [...out].sort(cmp[sort]);
  }, [items, sort, minRating, onlyTag, genders, brands, bands]);

  const filterCount = brands.length + bands.length + (minRating ? 1 : 0) + (onlyTag ? 1 : 0);
  const toggle = <T,>(arr: T[], v: T) => (arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);

  const Chip = ({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) => (
    <button onClick={onClick}
      className={`shrink-0 rounded-full border px-5 py-2.5 text-[15px] ${on ? "border-brand bg-brand-soft text-brand" : "border-[#c9c9c9]"}`}>
      {children}
    </button>
  );

  return (
    <main className="pb-24">
      <TopBar title={title} />

      <div className="flex gap-3 overflow-x-auto no-scrollbar px-4 py-3">
        <Chip on={sort === "priceAsc"} onClick={() => setSort(sort === "priceAsc" ? "relevance" : "priceAsc")}>Price (low → high)</Chip>
        <Chip on={minRating} onClick={() => setMinRating(!minRating)}>Rating: 4<span className="text-[#FF9340]">★</span>Above</Chip>
        {["Clearance", "Price drop", "New arrival", ...tags.filter((t) => !["Clearance", "Price drop", "New arrival"].includes(t))].map((t) => (
          <Chip key={t} on={onlyTag === t} onClick={() => setOnlyTag(onlyTag === t ? null : t)}>{t}</Chip>
        ))}
      </div>

      <CouponBanner />

      <p className="px-4 pt-3 pb-1 text-sm text-muted">{shown.length} product{shown.length === 1 ? "" : "s"}</p>

      {shown.length ? (
        <div className="grid grid-cols-2 gap-px bg-line border-y border-line">
          {shown.map((p) => <ProductCard key={p.id} p={toCard(p)} />)}
        </div>
      ) : (
        empty ?? <p className="px-6 py-16 text-center text-muted">No products match these filters.</p>
      )}

      <nav className="bottom-bar fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[440px] bg-white border-t border-line grid grid-cols-3 h-[76px] z-30">
        <BarBtn icon={<IconUsers />} label="Gender" active={genders.length > 0} onClick={() => setSheet("gender")} />
        <BarBtn icon={<IconSort />} label="Sort" active={sort !== "relevance"} onClick={() => setSheet("sort")} />
        <BarBtn icon={<IconFilter />} label={filterCount ? `Filter (${filterCount})` : "Filter"} active={filterCount > 0} onClick={() => setSheet("filter")} />
      </nav>

      <ChatFab bottom="bottom-24" />

      <BottomSheet open={sheet === "sort"} onClose={() => setSheet(null)} title="Sort by">
        {(Object.keys(SORTS) as SortKey[]).map((k) => (
          <label key={k} className="flex items-center py-3 text-[16px]">
            {SORTS[k]}
            <input type="radio" name="sort" className="ml-auto w-5 h-5 accent-[#3643ba]" checked={sort === k}
              onChange={() => { setSort(k); setSheet(null); }} />
          </label>
        ))}
      </BottomSheet>

      <BottomSheet open={sheet === "gender"} onClose={() => setSheet(null)} title="Gender">
        {allGenders.map((g) => (
          <Check key={g} label={g} checked={genders.includes(g)} onChange={() => setGenders(toggle(genders, g))} />
        ))}
        <SheetActions onClear={() => setGenders([])} onApply={() => setSheet(null)} />
      </BottomSheet>

      <BottomSheet open={sheet === "filter"} onClose={() => setSheet(null)} title="Filter">
        <h3 className="font-semibold mb-1">Price</h3>
        {PRICE_BANDS.map((b, i) => <Check key={b.label} label={b.label} checked={bands.includes(i)} onChange={() => setBands(toggle(bands, i))} />)}
        <h3 className="font-semibold mt-4 mb-1">Brand</h3>
        {allBrands.map((b) => <Check key={b} label={b} checked={brands.includes(b)} onChange={() => setBrands(toggle(brands, b))} />)}
        <h3 className="font-semibold mt-4 mb-1">Rating</h3>
        <Check label="4★ & above" checked={minRating} onChange={() => setMinRating(!minRating)} />
        <SheetActions onClear={() => { setBrands([]); setBands([]); setMinRating(false); setOnlyTag(null); }} onApply={() => setSheet(null)} />
      </BottomSheet>
    </main>
  );
}

function BarBtn({ icon, label, active, onClick }: { icon: React.ReactNode; label: string; active: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} className={`flex flex-col items-center justify-center gap-1 ${active ? "text-brand" : "text-[#575757]"}`}>
      {icon}
      <span className="text-[15px] font-medium">{label}</span>
    </button>
  );
}

function Check({ label, checked, onChange }: { label: string; checked: boolean; onChange: () => void }) {
  return (
    <label className="flex items-center py-2.5 text-[15px]">
      {label}
      <input type="checkbox" checked={checked} onChange={onChange} className="ml-auto w-5 h-5 accent-[#3643ba]" />
    </label>
  );
}

function SheetActions({ onClear, onApply }: { onClear: () => void; onApply: () => void }) {
  return (
    <div className="flex gap-3 mt-5">
      <button onClick={onClear} className="flex-1 border border-ink rounded-full py-3 font-semibold">Clear</button>
      <button onClick={onApply} className="flex-1 bg-brand text-white rounded-full py-3 font-semibold">Apply</button>
    </div>
  );
}
