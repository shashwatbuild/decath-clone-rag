"use client";
import Link from "next/link";
import { useState } from "react";
import { img, inr } from "@/lib/products";
import { useStore } from "@/lib/store";
import { useExperiences } from "@/lib/experiences/store";
import { fitInsight } from "@/lib/experiences/model";
import type { LabProduct as Product } from "@/lib/lab/types";
export default function LabProduct({ product: p, disabled, owned = false, addFor }: { product: Product; disabled?: boolean; owned?: boolean; addFor?: string }) {
  const { cart, addToCart, showToast } = useStore();
  const [size, setSize] = useState("");
  const { data } = useExperiences();
  const memory = fitInsight(p.id, data.fits);
  const [addedHere, setAddedHere] = useState<string[]>([]);
  const needsSize = p.sizes.length > 1;
  const sizeValid = p.sizes.includes(size);
  const selected = needsSize ? sizeValid ? size : null : p.sizes[0] ?? null;
  const cartLine = cart.find(c => c.id === p.id && c.size === selected);
  const cartKey = JSON.stringify([p.id, selected]);
  const inCart = addFor ? !!cartLine && addedHere.includes(cartKey) : !!cartLine;
  return <div className="rounded-xl border border-line bg-white p-3">
    <div className="flex items-center gap-3">
      <Link href={`/p/${p.id}`} className="shrink-0 rounded-lg bg-[#f7f8fa] p-1">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={img(p.image, 160)} alt="" className="h-14 w-14 object-contain mix-blend-multiply" /></Link>
      <div className="min-w-0 flex-1"><Link href={`/p/${p.id}`} className="text-[14px] font-semibold leading-snug hover:text-brand">{p.shortName}</Link><p className="mt-1 text-[13px] text-muted">{owned ? "Already owned" : inr(p.price)}</p></div>
    </div>
    {!owned && memory.size && <button className="experience-text-button" onClick={() => setSize(memory.size!)}>Use remembered size {memory.size}</button>}
    {!owned && <div className="mt-3 flex flex-wrap gap-2">
      {needsSize && <select aria-label={`Size for ${p.shortName}`} className="lab-input min-w-0 flex-1" value={size} onChange={e => setSize(e.target.value)}><option value="">Choose size</option>{p.sizes.map(s => <option key={s}>{s}</option>)}</select>}
      <button className="lab-button lab-button-primary flex-1" disabled={disabled || !p.inStock || (needsSize && !sizeValid) || inCart || (cartLine?.qty ?? 0) >= 10} onClick={() => { if (needsSize && !p.sizes.includes(size)) return; addToCart(p.id, selected); setAddedHere(keys => [...keys, cartKey]); showToast("Added to your shopping cart"); }}>{inCart ? "In cart" : addFor ? `Add one for ${addFor}` : "Add to cart"}</button>
    </div>}
  </div>;
}
