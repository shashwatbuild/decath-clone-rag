"use client";

import Link from "next/link";
import { useState } from "react";
import { getProduct, img, inr } from "@/lib/products";
import { useStore } from "@/lib/store";
import { TopBar } from "@/components/ui";

const COUPONS: Record<string, { off: number; above: number }> = {
  NC100: { off: 100, above: 1499 },
  NC200: { off: 200, above: 2499 },
  NC300: { off: 300, above: 3499 },
};

export default function CartPage() {
  const { cart, setQty, removeFromCart, toggleWish, showToast } = useStore();
  const [code, setCode] = useState("");
  const [applied, setApplied] = useState<string | null>(null);

  const lines = cart.map((i) => ({ ...i, p: getProduct(i.id)! })).filter((l) => l.p);
  const mrp = lines.reduce((s, l) => s + l.p.mrp * l.qty, 0);
  const total = lines.reduce((s, l) => s + l.p.price * l.qty, 0);
  const coupon = applied && COUPONS[applied] && total >= COUPONS[applied].above ? COUPONS[applied].off : 0;
  const shipping = total === 0 || total >= 999 ? 0 : 99;
  const pay = total - coupon + shipping;

  if (!lines.length)
    return (
      <main>
        <TopBar title="My Cart" />
        <div className="px-8 py-24 text-center">
          <p className="text-xl font-semibold">Your cart is empty</p>
          <p className="text-muted mt-2">Find something you like and add it here.</p>
          <Link href="/" className="inline-block mt-6 bg-brand text-white rounded-full px-8 py-3 font-semibold">Continue shopping</Link>
        </div>
      </main>
    );

  return (
    <main className="pb-32 bg-[#F5F4F5] min-h-[var(--app-h)]">
      <TopBar title={`My Cart (${lines.reduce((n, l) => n + l.qty, 0)})`} />
      <div className="space-y-2 pt-2">
        {lines.map((l) => (
          <div key={l.id + l.size} className="bg-white p-4 flex gap-3">
            <Link href={`/p/${l.id}`} className="w-24 h-24 bg-[#F5F4F5] shrink-0">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={img(l.p.images[0], 200)} alt="" className="w-full h-full object-cover mix-blend-multiply" />
            </Link>
            <div className="flex-1 min-w-0">
              <p className="text-[14px] line-clamp-2"><b>{l.p.brand}</b> {l.p.name}</p>
              {l.size && <p className="text-[13px] text-muted mt-1">Size: {l.size}</p>}
              <div className="flex items-center gap-2 mt-1.5">
                <span className="font-bold">{inr(l.p.price * l.qty)}</span>
                {l.p.mrp > l.p.price && <s className="text-[13px] text-muted">{inr(l.p.mrp * l.qty)}</s>}
              </div>
              <div className="flex items-center gap-3 mt-2">
                <select value={l.qty} onChange={(e) => setQty(l.id, l.size, Number(e.target.value))} className="border border-line rounded px-2 py-1 text-sm">
                  {Array.from({ length: 10 }, (_, i) => <option key={i} value={i + 1}>Qty {i + 1}</option>)}
                </select>
                <button className="text-sm text-muted underline" onClick={() => removeFromCart(l.id, l.size)}>Remove</button>
                <button className="text-sm text-brand underline" onClick={() => { toggleWish(l.id); removeFromCart(l.id, l.size); showToast("Moved to wishlist"); }}>Move to wishlist</button>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-white mt-2 p-4">
        <h2 className="font-semibold">Apply coupon</h2>
        <div className="flex gap-2 mt-3">
          <input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="Enter code (try NC100)"
            className="flex-1 border border-line rounded-lg px-3 py-2.5 outline-none focus:border-brand" />
          <button onClick={() => {
            const c = COUPONS[code];
            if (!c) return showToast("Invalid coupon");
            if (total < c.above) return showToast(`Add ${inr(c.above - total)} more to use ${code}`);
            setApplied(code); showToast(`${code} applied`);
          }} className="px-5 rounded-lg bg-brand text-white font-semibold">Apply</button>
        </div>
      </div>

      <div className="bg-white mt-2 p-4 space-y-2 text-[15px]">
        <h2 className="font-semibold mb-1">Price details</h2>
        <Row k="Total MRP" v={inr(mrp)} />
        <Row k="Discount on MRP" v={`− ${inr(mrp - total)}`} green />
        {coupon > 0 && <Row k={`Coupon (${applied})`} v={`− ${inr(coupon)}`} green />}
        <Row k="Shipping" v={shipping ? inr(shipping) : "FREE"} green={!shipping} />
        <div className="border-t border-line pt-2"><Row k="Total amount" v={inr(pay)} bold /></div>
      </div>

      <div className="bottom-bar fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[440px] bg-white border-t border-line flex items-center gap-4 px-4 py-3 z-30">
        <div><p className="font-bold text-lg">{inr(pay)}</p><p className="text-xs text-[#3d9a6d]">You save {inr(mrp - total + coupon)}</p></div>
        <button onClick={() => showToast("Checkout is disabled in this demo")} className="flex-1 h-[52px] rounded-full bg-brand text-white font-medium text-[17px]">Checkout</button>
      </div>
    </main>
  );
}

function Row({ k, v, green, bold }: { k: string; v: string; green?: boolean; bold?: boolean }) {
  return (
    <div className={`flex ${bold ? "font-bold" : ""}`}>
      <span>{k}</span>
      <span className={`ml-auto ${green ? "text-[#3d9a6d]" : ""}`}>{v}</span>
    </div>
  );
}
