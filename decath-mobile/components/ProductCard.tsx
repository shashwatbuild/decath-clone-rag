"use client";

import Link from "next/link";
import { useStore } from "@/lib/store";
import { discountPct, img, inr } from "@/lib/products";
import type { ProductLite } from "@/lib/types";
import { IconBasketPlus, IconHeart } from "./Icons";
import { Stars } from "./ui";

type CardProduct = ProductLite & { offers?: string[]; sizes?: string[] };

export function Tag({ tag, className = "" }: { tag: string | null; className?: string }) {
  if (!tag) return null;
  const tone = tag === "New arrival" ? "bg-brand-soft text-brand" : tag === "Only online" ? "bg-[#DDF1E8] text-[#0b7a4f]" : "bg-[#FFD54F] text-ink";
  return <span className={`${tone} rounded-md text-[11px] leading-4 font-semibold px-2 py-1 ${className}`}>{tag}</span>;
}

export default function ProductCard({ p, compact = false }: { p: CardProduct; compact?: boolean }) {
  const { wishlist, toggleWish, addToCart, showToast } = useStore();
  const wished = wishlist.includes(p.id);
  const off = discountPct(p);
  const needsSize = (p.sizes?.length ?? 0) > 1;

  return (
    <article className="product-card bg-white flex flex-col h-full rounded-2xl border border-line overflow-hidden">
      <Link href={`/p/${p.id}`} className="relative block aspect-square bg-[#F5F4F5] overflow-hidden p-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={img(p.image, 500)} alt={p.name} loading="lazy" className="w-full h-full object-contain mix-blend-multiply" />
        <Tag tag={p.tag} className="absolute top-2.5 left-2.5 max-w-[calc(100%-20px)]" />
      </Link>
      <div className={`flex flex-col flex-1 p-3 ${compact ? "lg:p-3.5" : "lg:p-4"}`}>
        <p className="text-[11px] font-semibold tracking-normal text-muted mb-1">{p.brand.charAt(0).toUpperCase() + p.brand.slice(1).toLowerCase()}</p>
        <Link href={`/p/${p.id}`} title={p.name} className="text-[14px] leading-[1.5] font-medium text-ink line-clamp-2 min-h-[42px] hover:text-brand">
          {p.shortName}
        </Link>
        <div className="flex items-center gap-1.5 mt-2.5 h-5">
          {p.reviewCount > 0 ? (
            <>
              <Stars value={p.rating} size={14} />
              <span className="text-[12px] text-muted tabular-nums">{p.reviewCount >= 1000 ? (p.reviewCount / 1000).toFixed(1) + "K" : p.reviewCount}</span>
            </>
          ) : <span className="text-[12px] text-muted">No reviews yet</span>}
        </div>
        <div className="mt-auto pt-3 flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="text-[19px] leading-6 font-semibold tracking-tight tabular-nums">{inr(p.price)}</span>
          {off >= 30 && <span className="bg-[#FFD54F]/60 rounded-md text-[11px] px-1.5 py-0.5 font-semibold whitespace-nowrap">{off}% off</span>}
        </div>
        <div className="text-[12px] text-muted mt-1 min-h-[19px]">
          {p.mrp > p.price && <>MRP <s className="tabular-nums">{inr(p.mrp)}</s></>}
        </div>
        {!compact && (
          <div className="mt-3 pt-3 border-t border-line">
            <p className="h-[18px] truncate text-[11px] text-[#0b7a4f] mb-2" title={p.offers?.[0]}>{p.offers?.[0]}</p>
            <div className="flex items-center gap-2">
            <button aria-label={wished ? "Remove from wishlist" : "Add to wishlist"} aria-pressed={wished}
              onClick={() => { toggleWish(p.id); showToast(wished ? "Removed from wishlist" : "Added to wishlist"); }}
              className="w-11 h-11 border border-line rounded-xl grid place-items-center shrink-0 hover:bg-brand-soft">
              <IconHeart className={`w-5 h-5 ${wished ? "text-brand" : ""}`} filled={wished} />
            </button>
            <button aria-label="Add to cart"
              onClick={() => {
                if (needsSize) { window.location.href = `/p/${p.id}#size`; return; }
                addToCart(p.id, p.sizes?.[0] ?? null); showToast("Added to cart");
              }}
              className="flex-1 min-w-11 h-11 border border-brand/20 text-brand bg-brand-soft/40 rounded-xl grid place-items-center shrink-0 hover:bg-brand-soft">
              <IconBasketPlus />
            </button>
            </div>
          </div>
        )}
      </div>
    </article>
  );
}
