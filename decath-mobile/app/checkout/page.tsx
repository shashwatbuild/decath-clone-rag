"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getProduct, img, inr } from "@/lib/products";
import { useStore } from "@/lib/store";
import { cartTotals } from "@/lib/pricing";
import { DEMO_TOP_UP, getBalance, payWithWallet, placeCodOrder, topUpDemo, type Order } from "@/lib/wallet";
import { TopBar } from "@/components/ui";

type Method = "wallet" | "cod";

export default function CheckoutPage() {
  const { cart, pincode, removeFromCart, showToast } = useStore();
  const [coupon, setCoupon] = useState<string | null>(null);
  const [balance, setBalance] = useState<number | null>(null);
  const [method, setMethod] = useState<Method>("wallet");
  const [confirming, setConfirming] = useState(false);
  const [order, setOrder] = useState<Order | null>(null);

  useEffect(() => {
    setBalance(getBalance());
    try { setCoupon(localStorage.getItem("dc.coupon")); } catch {}
  }, []);

  const lines = cart.map((i) => ({ ...i, p: getProduct(i.id)! })).filter((l) => l.p);
  const { pay, saved, shipping } = cartTotals(lines, coupon);

  if (order)
    return (
      <main>
        <TopBar title="Order placed" back={false} />
        <div className="px-8 py-16 text-center">
          <div className="mx-auto w-16 h-16 rounded-full bg-[#3d9a6d] text-white grid place-items-center text-3xl">✓</div>
          <p className="text-xl font-semibold mt-5">Thanks, your order is placed</p>
          <p className="text-muted mt-2">Order <b>{order.id}</b> · {inr(order.amount)} · {order.method === "wallet" ? "Paid from demo wallet" : "Cash on delivery"}</p>
          <p className="text-sm text-muted mt-3">Demo only: no real money moved and nothing was shipped.</p>
          <Link href="/" className="inline-block mt-8 bg-brand text-white rounded-full px-8 py-3 font-semibold">Continue shopping</Link>
        </div>
      </main>
    );

  if (!lines.length)
    return (
      <main>
        <TopBar title="Checkout" />
        <div className="px-8 py-24 text-center">
          <p className="text-xl font-semibold">Nothing to check out</p>
          <p className="text-muted mt-2">Add something to your cart first.</p>
          <Link href="/cart" className="inline-block mt-6 bg-brand text-white rounded-full px-8 py-3 font-semibold">Go to cart</Link>
        </div>
      </main>
    );

  const canWallet = balance !== null && balance >= pay;

  function placeOrder() {
    const lines_ = cart.map((i) => ({ ...i }));
    const o = method === "wallet" ? payWithWallet(pay, lines_) : placeCodOrder(pay, lines_);
    if (!o) return showToast("Not enough demo balance. Add demo money or pay on delivery.");
    lines_.forEach((i) => removeFromCart(i.id, i.size));
    setBalance(getBalance());
    setConfirming(false);
    setOrder(o);
  }

  return (
    <main className="pb-32 bg-[#F5F4F5] min-h-[var(--app-h)]">
      <TopBar title="Checkout" />

      <section className="bg-white p-4 mt-2">
        <p className="text-sm text-muted">Delivering to pincode</p>
        <p className="font-semibold">{pincode}</p>
      </section>

      <section className="bg-white mt-2 p-4">
        <h2 className="font-semibold mb-3">Order summary</h2>
        <div className="space-y-2">
          {lines.map((l) => (
            <div key={l.id + l.size} className="flex gap-3 items-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={img(l.p.images[0], 120)} alt="" className="w-12 h-12 object-cover mix-blend-multiply bg-[#F5F4F5]" />
              <p className="flex-1 text-[14px] line-clamp-2">{l.p.shortName}{l.size ? ` · ${l.size}` : ""} × {l.qty}</p>
              <span className="text-[14px] font-semibold">{inr(l.p.price * l.qty)}</span>
            </div>
          ))}
        </div>
        <div className="border-t border-line mt-3 pt-3 text-[15px] space-y-1">
          {saved > 0 && <p className="flex justify-between text-[#3d9a6d]"><span>You save</span><span>{inr(saved)}</span></p>}
          <p className="flex justify-between"><span>Shipping</span><span>{shipping ? inr(shipping) : "FREE"}</span></p>
          <p className="flex justify-between font-bold text-[17px]"><span>To pay</span><span>{inr(pay)}</span></p>
        </div>
      </section>

      <section className="bg-white mt-2 p-4">
        <h2 className="font-semibold mb-3">Payment method</h2>
        <label className={`flex items-start gap-3 border rounded-xl p-3 mb-2 ${method === "wallet" ? "border-brand" : "border-line"}`}>
          <input type="radio" name="pay" checked={method === "wallet"} onChange={() => setMethod("wallet")} className="mt-1 accent-[var(--brand,#0082C3)]" />
          <div className="flex-1">
            <p className="font-semibold">Demo wallet</p>
            <p className="text-sm text-muted">Balance {balance === null ? "…" : inr(balance)} · simulated, no real money</p>
            {balance !== null && !canWallet && <p className="text-sm text-[#c0392b] mt-1">Not enough balance for this order</p>}
            <button type="button" onClick={() => { const b = topUpDemo(); setBalance(b); showToast(`Added ${inr(DEMO_TOP_UP)} demo money`); }}
              className="text-sm text-brand underline mt-2">Add {inr(DEMO_TOP_UP)} demo money</button>
          </div>
        </label>
        <label className={`flex items-start gap-3 border rounded-xl p-3 ${method === "cod" ? "border-brand" : "border-line"}`}>
          <input type="radio" name="pay" checked={method === "cod"} onChange={() => setMethod("cod")} className="mt-1 accent-[var(--brand,#0082C3)]" />
          <div><p className="font-semibold">Cash on delivery</p><p className="text-sm text-muted">Pay when your order arrives</p></div>
        </label>
      </section>

      <div className="bottom-bar fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[440px] bg-white border-t border-line flex items-center gap-4 px-4 py-3 z-30">
        <div><p className="font-bold text-lg">{inr(pay)}</p><p className="text-xs text-muted">Review before you pay</p></div>
        <button
          disabled={method === "wallet" && !canWallet}
          onClick={() => setConfirming(true)}
          className="flex-1 h-[52px] rounded-full bg-brand text-white font-medium text-[17px] disabled:opacity-40"
        >Continue</button>
      </div>

      {confirming && (
        <div className="fixed inset-0 z-40 bg-black/40 flex items-end justify-center" role="dialog" aria-modal="true" aria-label="Confirm payment">
          <div className="w-full max-w-[440px] bg-white rounded-t-2xl p-5">
            <p className="text-lg font-semibold">Confirm your payment</p>
            <p className="text-muted mt-2">
              {method === "wallet"
                ? <>Pay <b>{inr(pay)}</b> from your demo wallet. Balance after: <b>{inr((balance ?? 0) - pay)}</b>.</>
                : <>Place the order for <b>{inr(pay)}</b>, paid in cash on delivery.</>}
            </p>
            <p className="text-xs text-muted mt-2">Demo only: no real money moves.</p>
            <div className="flex gap-3 mt-5">
              <button onClick={() => setConfirming(false)} className="flex-1 h-12 rounded-full border border-line font-medium">Cancel</button>
              <button onClick={placeOrder} className="flex-1 h-12 rounded-full bg-brand text-white font-medium">Confirm and pay</button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
