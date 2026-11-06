const COUPONS = [
  { off: 100, above: 1499, code: "NC100" },
  { off: 200, above: 2499, code: "NC200" },
  { off: 300, above: 3499, code: "NC300" },
];

export function CouponBanner() {
  return (
    <div className="flex items-stretch gap-0 overflow-x-auto no-scrollbar bg-[#2a3150] text-white">
      <div className="shrink-0 bg-white text-ink px-3 py-3 w-[150px] flex flex-col justify-center">
        <p className="text-[12px] font-semibold leading-tight">Save on your first order! Use your coupon today.</p>
        <span className="mt-2 inline-block w-fit bg-brand text-white text-[10px] px-3 py-1 rounded-full">Shop Now</span>
      </div>
      {COUPONS.map((c) => (
        <div key={c.code} className="flex items-center shrink-0 py-2 pl-2">
          <span className="bg-brand h-full w-7 grid place-items-center rounded-l-md">
            <span className="text-[11px] font-bold -rotate-90 whitespace-nowrap">{c.code}</span>
          </span>
          <div className="bg-white text-ink rounded-r-md px-3 py-1.5 mr-1 w-[130px] text-center">
            <p className="text-[17px] font-extrabold leading-none">₹{c.off} OFF</p>
            <p className="text-[9px] mt-1">On purchase <span className="text-brand">above</span></p>
            <p className="text-[15px] font-bold text-brand leading-tight">₹{c.above}</p>
            <p className="text-[9px] mt-0.5 bg-brand text-white rounded px-1">Use Code - {c.code}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
