const COUPONS = [
  { off: 100, above: 1499, code: "NC100" },
  { off: 200, above: 2499, code: "NC200" },
  { off: 300, above: 3499, code: "NC300" },
];

export function CouponBanner() {
  return (
    <div className="coupon-strip flex items-stretch gap-3 overflow-x-auto no-scrollbar rounded-2xl border border-line bg-[#2a3150] p-3">
      <div className="shrink-0 bg-white text-ink rounded-xl px-4 py-3 w-[156px] flex flex-col justify-center">
        <p className="text-[13px] font-semibold leading-relaxed">A little extra for your first order</p>
        <p className="mt-1 text-[12px] text-muted">Apply a code in your cart</p>
      </div>
      {COUPONS.map((c) => (
        <div key={c.code} className="shrink-0 lg:flex-1 w-[156px] rounded-xl bg-white px-4 py-3">
          <p className="text-[20px] font-semibold tracking-tight text-ink">₹{c.off} off</p>
          <p className="text-[12px] mt-1 text-muted">On orders above ₹{c.above.toLocaleString("en-IN")}</p>
          <p className="mt-2 inline-flex rounded-md bg-brand-soft px-2 py-1 text-[12px] font-semibold tracking-wide text-brand">{c.code}</p>
        </div>
      ))}
    </div>
  );
}
