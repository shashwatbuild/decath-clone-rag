"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { CATEGORIES, searchProducts } from "@/lib/products";
import ListingView from "@/components/ListingView";
import { IconBack, IconSearch } from "@/components/Icons";

function SearchInner() {
  const router = useRouter();
  const q = useSearchParams().get("q") ?? "";
  const [draft, setDraft] = useState(q);

  if (q) {
    const items = searchProducts(q);
    return (
      <ListingView key={q} title={`"${q}"`} items={items}
        empty={<p className="px-6 py-16 text-center text-muted">No results for “{q}”. Try “shoes”, “yoga” or “backpack”.</p>} />
    );
  }

  return (
    <main className="min-h-[var(--app-h)]">
      <form onSubmit={(e) => { e.preventDefault(); if (draft.trim()) router.push(`/search?q=${encodeURIComponent(draft.trim())}`); }}
        className="flex items-center gap-2 px-3 h-16 border-b border-line">
        <button type="button" onClick={() => router.back()} aria-label="Back"><IconBack className="w-7 h-7" /></button>
        <div className="flex-1 flex items-center gap-2 border border-line rounded-full px-4 py-2.5">
          <IconSearch className="w-5 h-5 text-muted" />
          <input autoFocus value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Search products, sports…"
            className="flex-1 outline-none text-[16px]" />
        </div>
      </form>
      <h2 className="px-4 pt-5 pb-2 font-semibold">Popular categories</h2>
      <div className="flex flex-wrap gap-2 px-4">
        {CATEGORIES.map((c) => (
          <Link key={c.slug} href={`/c/${c.slug}`} className="border border-line rounded-full px-4 py-2 text-sm">{c.name}</Link>
        ))}
      </div>
      <h2 className="px-4 pt-6 pb-2 font-semibold">Try searching</h2>
      <div className="flex flex-wrap gap-2 px-4">
        {["kiprun", "domyos", "trekking bag", "football", "women yoga", "cycle"].map((s) => (
          <Link key={s} href={`/search?q=${encodeURIComponent(s)}`} className="bg-[#F5F4F5] rounded-full px-4 py-2 text-sm">{s}</Link>
        ))}
      </div>
    </main>
  );
}

export default function SearchPage() {
  return <Suspense><SearchInner /></Suspense>;
}
