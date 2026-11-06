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
  const tone = tag === "New arrival" ? "bg-[#E3E6F7]" : tag === "Only online" ? "bg-[#DDF1E8]" : "bg-[#FFD54F]";
  return <span className={`${tone} text-[13px] px-2 py-0.5 ${className}`}>{tag}</span>;
}

export default function ProductCard({ p, compact = false }: { p: CardProduct; compact?: boolean }) {
  const { wishlist, toggleWish, addToCart, showToast } = useStore();
  const wished = wishlist.includes(p.id);
  const off = discountPct(p);
  const needsSize = (p.sizes?.length ?? 0) > 1;

  return (
    <div className="bg-white flex flex-col">
      <Link href={`/p/${p.id}`} className="relative block aspect-square bg-[#F5F4F5] overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={img(p.image, 500)} alt={p.name} loading="lazy" className="w-full h-full object-cover mix-blend-multiply" />
        <Tag tag={p.tag} className="absolute top-0 left-0" />
      </Link>
      <div className={`flex flex-col flex-1 ${compact ? "px-3 pt-3 pb-3" : "px-3 pt-3 pb-4"}`}>
        <Link href={`/p/${p.id}`} className="text-[15px] leading-[1.35] text-[#575757] line-clamp-2 min-h-[40px]">
          <b className="font-bold text-[#4a4a4a]">{p.brand}</b> {p.name}
        </Link>
        <div className="flex items-center gap-1.5 mt-2 h-5">
          {p.reviewCount > 0 ? (
            <>
              <Stars value={p.rating} size={17} />
              <span className="text-[14px] text-[#575757]">{p.reviewCount >= 1000 ? (p.reviewCount / 1000).toFixed(1) + "K" : p.reviewCount}</span>
            </>
          ) : (
            <Stars value={0} size={17} />
          )}
        </div>
        <div className="mt-2 flex items-center gap-2">
          <span className="text-[19px] font-bold">{inr(p.price)}</span>
          {off >= 30 && <span className="bg-[#FFD54F] text-[13px] px-1.5 py-0.5 font-medium">{off}% off</span>}
        </div>
        {p.mrp > p.price && (
          <div className="text-[14px] text-[#757575] mt-1">MRP <s>{inr(p.mrp)}</s></div>
        )}
        {!compact && (
          <div className="flex items-center gap-2 mt-3">
            {p.offers?.[0] ? (
              <span className="flex-1 bg-[#DDF1E8] text-[#0b7a4f] text-[12px] leading-tight rounded-md px-2 py-1.5 text-center line-clamp-2">{p.offers[0]}</span>
            ) : (
              <span className="flex-1" />
            )}
            <button aria-label="Add to wishlist" onClick={() => { toggleWish(p.id); showToast(wished ? "Removed from wishlist" : "Added to wishlist"); }}
              className="w-9 h-9 border border-[#9a9a9a] rounded-lg grid place-items-center shrink-0">
              <IconHeart className={`w-5 h-5 ${wished ? "text-brand" : ""}`} filled={wished} />
            </button>
            <button aria-label="Add to cart"
              onClick={() => {
                if (needsSize) { window.location.href = `/p/${p.id}#size`; return; }
                addToCart(p.id, p.sizes?.[0] ?? null); showToast("Added to cart");
              }}
              className="w-9 h-9 border border-[#9a9a9a] rounded-lg grid place-items-center shrink-0">
              <IconBasketPlus />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
