"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { Product } from "@/lib/types";
import { getProduct, img, inr, toCard } from "@/lib/products";
import { useStore } from "@/lib/store";
import ProductCard, { Tag } from "./ProductCard";
import { ChatFab, SectionTitle, Stars, TopBar } from "./ui";
import { IconClose, IconExchange, IconHeart, IconPlus, IconReturn, IconShare, IconShield, IconStore, IconTag, IconTruck } from "./Icons";

type Card = ReturnType<typeof toCard>;
type Review = { stars: number; text: string; name: string; daysAgo: number };

export default function ProductView({ p, fbt, similar, breakdown, reviews, aspects }: {
  p: Product; fbt: Card[]; similar: Card[]; breakdown: number[]; reviews: Review[]; aspects: { name: string; score: number }[];
}) {
  const { wishlist, toggleWish, addToCart, showToast, markViewed, recent } = useStore();
  const [size, setSize] = useState<string | null>(p.sizes.length === 1 ? p.sizes[0] : null);
  const [sizeError, setSizeError] = useState(false);
  const sizeRef = useRef<HTMLDivElement>(null);
  const wished = wishlist.includes(p.id);

  useEffect(() => { markViewed(p.id); }, [p.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const recentCards = recent.filter((id) => id !== p.id).map(getProduct).filter(Boolean).slice(0, 6).map((x) => toCard(x!));

  const onAdd = () => {
    if (p.sizes.length > 1 && !size) {
      setSizeError(true);
      sizeRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    addToCart(p.id, size);
    showToast("Added to cart");
  };

  const share = async () => {
    const url = window.location.href;
    try {
      if (navigator.share) await navigator.share({ title: p.name, url });
      else { await navigator.clipboard.writeText(url); showToast("Link copied"); }
    } catch {}
  };

  return (
    <main className="pb-28">
      <TopBar />
      <Gallery p={p} />

      <section className="px-4 pt-4">
        <h1 className="text-[20px] leading-snug"><b className="font-bold">{p.brand}</b> {p.name}</h1>
        <div className="flex items-center gap-2 mt-2">
          {p.reviewCount > 0 ? (
            <a href="#reviews" className="flex items-center gap-2">
              <span className="text-[17px]">{p.rating.toFixed(1)}</span>
              <Stars value={p.rating} size={20} />
              <span className="text-[#c9c9c9] mx-1">|</span>
              <span className="text-brand text-[16px]">{p.reviewCount} reviews</span>
            </a>
          ) : (
            <span className="text-muted text-sm">No reviews yet</span>
          )}
          <button onClick={share} className="ml-auto" aria-label="Share"><IconShare /></button>
        </div>
        <div className="flex items-baseline gap-3 mt-3">
          <span className="text-[30px] font-bold">{inr(p.price)}</span>
          {p.mrp > p.price && <span className="text-[16px] text-[#757575]">MRP <s>{inr(p.mrp)}</s></span>}
        </div>
        <p className="text-xs text-muted">Inclusive of all taxes</p>
      </section>

      {p.offers.length > 0 && (
        <div className="flex gap-3 overflow-x-auto no-scrollbar px-4 pt-4">
          {p.offers.map((o) => (
            <div key={o} className="shrink-0 min-w-[78%] flex items-center gap-3 border-2 border-[#3d9a6d] bg-[#F0F8F4] rounded-lg px-3 py-3">
              <span className="w-10 h-10 border border-[#9a9a9a] rounded-md grid place-items-center bg-white shrink-0"><IconTag /></span>
              <span className="text-[15px]">{o}</span>
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-3 gap-2 px-4 py-6 mt-4 border-y border-line">
        <Promise icon={<IconShield />} text={`${p.warrantyYears ?? 1} year warranty`} />
        <Promise icon={<IconReturn />} text="30 days return" />
        <Promise icon={<IconExchange />} text="30 days exchange" />
      </div>

      {p.sizes.length > 0 && (
        <section id="size" ref={sizeRef} className="px-4 pt-5 pb-5 border-b border-line scroll-mt-[120px]">
          <div className="flex items-center">
            <h2 className="text-[19px] font-semibold">Select Size</h2>
            <a href="https://www.decathlon.in/page/size-guide" target="_blank" rel="noreferrer" className="ml-auto text-brand font-semibold text-[15px]">View Size Chart</a>
          </div>
          {p.recommendedCount > 0 && (
            <p className="text-sm text-muted mt-2">{Math.round((p.recommendedCount / p.reviewCount) * 100)}% recommend this product</p>
          )}
          <div className="flex gap-2 overflow-x-auto no-scrollbar mt-3">
            {p.sizes.map((s) => (
              <button key={s} onClick={() => { setSize(s); setSizeError(false); }}
                className={`shrink-0 min-w-[78px] px-3 h-[54px] border text-[16px] ${size === s ? "border-brand border-2 bg-brand-soft" : "border-[#9a9a9a]"}`}>
                {s}
              </button>
            ))}
          </div>
          {sizeError && <p className="text-red-600 text-sm mt-2">Please select a size</p>}
        </section>
      )}

      <Delivery />

      <section className="px-4 pt-6 pb-4">
        <div className="flex items-baseline">
          <h2 className="text-[21px] font-semibold">Product details</h2>
          <span className="ml-auto text-muted text-sm">ID:{p.id}</span>
        </div>
        <p className="text-[15px] leading-relaxed mt-3">{p.description}</p>
      </section>

      <Accordion title="Benefits">
        <ul className="space-y-4">
          {p.benefits.map((b) => (
            <li key={b.name} className="text-[15px] leading-relaxed"><span className="font-medium">{b.name}:</span> {b.value}</li>
          ))}
        </ul>
      </Accordion>
      <Accordion title="Technical Information">
        <KVList items={[
          ...p.technicalInformation,
          { name: "Warranty", value: String(p.warrantyYears ?? "-") },
          { name: "Mrp", value: `${inr(p.mrp)} inclusive of all taxes` },
          { name: "Country of origin", value: p.madeIn || "India" },
          { name: "Sold by", value: "Demo store (data sourced from decathlon.in)" },
        ]} />
      </Accordion>
      <Accordion title="Product Specifications"><KVList items={p.specifications} /></Accordion>
      {p.materialAndCare.length > 0 && (
        <Accordion title="Material & Care">
          <h3 className="text-[18px] mb-3">Composition</h3>
          <KVList items={p.materialAndCare} />
        </Accordion>
      )}

      <SectionTitle>Frequently Bought Together</SectionTitle>
      <Rail items={fbt} />
      <SectionTitle>Similar Products</SectionTitle>
      <Rail items={similar} />
      {recentCards.length > 0 && (
        <>
          <SectionTitle>Recently Viewed Products</SectionTitle>
          <Rail items={recentCards} />
        </>
      )}

      <Ratings p={p} breakdown={breakdown} reviews={reviews} aspects={aspects} />

      <div className="px-4 pt-6 text-xs text-muted">
        Product data from <a className="underline" href={p.sourceUrl} target="_blank" rel="noreferrer">decathlon.in</a>. Review text is sample data.
      </div>

      <ChatFab bottom="bottom-28" context={p.id} />

      <div className="bottom-bar fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[440px] bg-white border-t border-line flex items-center gap-3 px-4 py-3 z-30">
        <button aria-label="Wishlist" onClick={() => { toggleWish(p.id); showToast(wished ? "Removed from wishlist" : "Added to wishlist"); }}
          className="w-[60px] h-[60px] rounded-full border-2 border-[#9a9a9a] grid place-items-center shrink-0">
          <IconHeart className={`w-7 h-7 ${wished ? "text-brand" : ""}`} filled={wished} />
        </button>
        <button onClick={onAdd} disabled={!p.inStock} className="flex-1 h-[56px] rounded-full bg-brand text-white text-[18px] font-medium disabled:opacity-50">
          {p.inStock ? "Add to cart" : "Out of stock"}
        </button>
      </div>
    </main>
  );
}

function Gallery({ p }: { p: Product }) {
  const [idx, setIdx] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const go = (i: number) => {
    setIdx(i);
    ref.current?.scrollTo({ left: i * ref.current.clientWidth, behavior: "smooth" });
  };
  return (
    <div>
      <div className="relative bg-[#F5F4F5]">
        <div ref={ref} onScroll={(e) => { const el = e.currentTarget; setIdx(Math.round(el.scrollLeft / el.clientWidth)); }}
          className="flex overflow-x-auto no-scrollbar snap-x-mandatory aspect-square">
          {p.images.map((u, i) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={u} src={img(u, 900)} alt={`${p.name} image ${i + 1}`} className="w-full h-full object-contain shrink-0 snap-start mix-blend-multiply" />
          ))}
        </div>
        <Tag tag={p.tag} className="absolute top-0 left-0 text-[15px] px-2.5 py-1" />
        <Link href={`/c/${p.category.toLowerCase().replace(/\s+/g, "-")}`}
          className="absolute left-4 bottom-4 bg-white/95 rounded-full px-6 py-2.5 text-[16px] border border-line">View Similar</Link>
        <span className="absolute right-4 bottom-4 bg-white/95 rounded-full px-6 py-2.5 text-[16px] border border-line">{idx + 1}/{p.images.length}</span>
      </div>
      <div className="flex gap-2.5 overflow-x-auto no-scrollbar px-4 pt-3">
        {p.images.map((u, i) => (
          <button key={u} onClick={() => go(i)} className={`shrink-0 w-[92px] h-[92px] bg-[#F5F4F5] border-2 ${i === idx ? "border-brand" : "border-line"}`}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={img(u, 200)} alt="" className="w-full h-full object-cover mix-blend-multiply" />
          </button>
        ))}
      </div>
    </div>
  );
}

function Promise({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="shrink-0">{icon}</span>
      <span className="text-[14px] leading-tight">{text}</span>
    </div>
  );
}

function Delivery() {
  const [info, setInfo] = useState<{ date: string; left: string } | null>(null);
  useEffect(() => {
    const now = new Date();
    const d = new Date(now); d.setDate(d.getDate() + 4);
    const cutoff = new Date(now); cutoff.setHours(24 + 10, 0, 0, 0);
    const mins = Math.floor((cutoff.getTime() - now.getTime()) / 60000);
    setInfo({
      date: d.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "short" }),
      left: `${Math.floor(mins / 60)} hrs ${mins % 60} min`,
    });
  }, []);
  return (
    <section className="px-4 pt-5 pb-6 border-b border-line">
      <h2 className="text-[19px] font-semibold">Delivery & services</h2>
      <p className="text-[15px] mt-1">Sold and fulfilled by : <b className="font-semibold">Demo Sports Store</b></p>
      <div className="flex gap-3 mt-5">
        <span className="w-2.5 h-2.5 mt-2 rounded-full bg-[#3d9a6d] shrink-0" /><IconTruck className="w-7 h-7 shrink-0" />
        <div>
          <p className="text-[16px] font-medium">Standard delivery by {info?.date ?? "…"}</p>
          <p className="text-[15px]">Order within <span className="text-[#3d9a6d]">{info?.left ?? "…"}</span></p>
        </div>
      </div>
      <div className="flex gap-3 mt-4">
        <span className="w-2.5 h-2.5 mt-2 rounded-full bg-[#3d9a6d] shrink-0" /><IconStore className="w-7 h-7 shrink-0" />
        <div>
          <p className="text-[16px] font-medium">Pick up from store within 2hrs for FREE</p>
          <a href="https://www.decathlon.in/store" target="_blank" rel="noreferrer" className="text-brand text-[15px]">View Stores</a>
        </div>
      </div>
    </section>
  );
}

function Accordion({ title, children }: { title: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-t border-line last-of-type:border-b">
      <button onClick={() => setOpen(!open)} className="w-full flex items-center px-4 py-6 text-[19px]">
        {title}
        <span className="ml-auto">{open ? <IconClose className="w-5 h-5" /> : <IconPlus className="w-6 h-6" />}</span>
      </button>
      {open && <div className="px-4 pb-6">{children}</div>}
    </div>
  );
}

function KVList({ items }: { items: { name: string; value: string }[] }) {
  return (
    <dl className="divide-y divide-line">
      {items.map((k) => (
        <div key={k.name} className="py-4 first:pt-0">
          <dt className="font-semibold text-[15px]">{k.name}</dt>
          <dd className="text-[15px] mt-1.5 leading-relaxed whitespace-pre-line">{k.value}</dd>
        </div>
      ))}
    </dl>
  );
}

function Rail({ items }: { items: Card[] }) {
  return (
    <div className="flex gap-2 overflow-x-auto no-scrollbar snap-x-mandatory">
      {items.map((x) => (
        <div key={x.id} className="w-[46%] shrink-0 snap-start"><ProductCard p={x} compact /></div>
      ))}
    </div>
  );
}

function Ratings({ p, breakdown, reviews, aspects }: { p: Product; breakdown: number[]; reviews: Review[]; aspects: { name: string; score: number }[] }) {
  const [filter, setFilter] = useState<number | null>(null);
  if (!p.reviewCount) return null;
  const max = Math.max(...breakdown, 1);
  const list = filter ? reviews.filter((r) => r.stars === filter) : reviews;
  return (
    <section id="reviews" className="px-5 pt-8 scroll-mt-28">
      <h2 className="text-[20px]">Ratings</h2>
      <div className="flex gap-6 mt-4">
        <div>
          <p><span className="text-[46px] font-bold leading-none">{p.rating.toFixed(1)}</span> <span className="text-[16px]">out of 5</span></p>
          <div className="mt-2"><Stars value={p.rating} size={24} /></div>
          <p className="text-brand mt-2">{p.reviewCount} reviews</p>
        </div>
        <div className="flex-1 space-y-1.5">
          {breakdown.map((n, i) => (
            <div key={i} className="flex items-center gap-2 text-[15px]">
              <span className="w-8">{5 - i} <span className="text-[#FF9340]">★</span></span>
              <span className="flex-1 h-[6px] rounded-full bg-[#EDEDED] overflow-hidden"><span className="block h-full bg-[#757575] rounded-full" style={{ width: `${(n / max) * 100}%` }} /></span>
              <span className="w-10 text-right">{n}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-4 gap-2 mt-8 pb-6 border-b border-line">
        {aspects.map((a) => (
          <div key={a.name} className="flex flex-col items-center text-center gap-2">
            <svg viewBox="0 0 44 44" className="w-[72px] h-[72px]">
              <circle cx="22" cy="22" r="19" fill="none" stroke="#EDEDED" strokeWidth="3" />
              <circle cx="22" cy="22" r="19" fill="none" stroke="#3643BA" strokeWidth="3" strokeLinecap="round"
                strokeDasharray={`${(a.score / 5) * 119.4} 119.4`} transform="rotate(-90 22 22)" />
              <text x="22" y="26" textAnchor="middle" fontSize="11">{a.score}/5</text>
            </svg>
            <span className="text-[13px] leading-tight">{a.name}</span>
          </div>
        ))}
      </div>
      <div className="flex items-center pt-6">
        <h3 className="text-[20px]">Reviews</h3>
        <select value={filter ?? ""} onChange={(e) => setFilter(e.target.value ? Number(e.target.value) : null)}
          className="ml-auto text-[17px] bg-transparent outline-none">
          <option value="">All stars</option>
          <option value="5">5 Star</option>
          <option value="4">4 Star</option>
        </select>
      </div>
      {list.map((r, i) => (
        <div key={i} className="py-5 border-b border-line">
          <div className="flex items-center gap-2"><span className="text-[17px]">{r.stars.toFixed(1)}</span><Stars value={r.stars} size={20} /></div>
          <p className="text-[16px] mt-2">{r.text}</p>
          <p className="text-[14px] text-muted mt-2">{r.name} <span className="text-[#3d9a6d]">✓ Verified user</span> | {r.daysAgo} days ago | India</p>
        </div>
      ))}
      {list.length === 0 && <p className="py-6 text-muted">No reviews with this rating.</p>}
    </section>
  );
}
