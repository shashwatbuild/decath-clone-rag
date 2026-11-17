"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { img, inr } from "@/lib/products";
import { useStore } from "@/lib/store";
import { GOALS, buildPlan, type Goal, type PlanLine } from "@/lib/plan";
import { TopBar } from "@/components/ui";

const BUDGETS = [3000, 5000, 10000];

export default function PlanPage() {
  const { addToCart, cart, showToast } = useStore();
  const [goal, setGoal] = useState<Goal>("badminton");
  const [weeks, setWeeks] = useState(4);
  const [budget, setBudget] = useState(5000);
  const [owned, setOwned] = useState<string[]>([]);

  // A chat request like "10K in 8 weeks, ₹5,000 budget" arrives as /plan?goal=running&weeks=8&budget=5000.
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const g = q.get("goal");
    if (g && g in GOALS) setGoal(g as Goal);
    const w = Number(q.get("weeks"));
    if (w >= 1 && w <= 12) setWeeks(w);
    const b = Number(q.get("budget"));
    if (b >= 500) setBudget(b);
  }, []);

  const plan = useMemo(() => buildPlan({ goal, weeks, budget, owned }), [goal, weeks, budget, owned]);
  const inCart = (line: PlanLine) => !!line.product && cart.some((c) => c.id === line.product!.id);

  function toggleOwned(id: string) {
    setOwned((o) => (o.includes(id) ? o.filter((x) => x !== id) : [...o, id]));
  }

  return (
    <main className="pb-32 lg:pb-12 bg-[#F5F4F5] min-h-[var(--app-h)]">
      <TopBar title="Training plan" />

      <div className="lg:grid lg:grid-cols-[360px_1fr] lg:gap-8 lg:px-4 lg:items-start lg:pt-2">
      <section className="bg-white p-4 space-y-4 lg:rounded-xl lg:border lg:border-line lg:sticky lg:top-44">
        <div>
          <p className="text-sm text-muted mb-2">What are you training for?</p>
          <div className="flex gap-2">
            {(Object.keys(GOALS) as Goal[]).map((g) => (
              <button key={g} onClick={() => { setGoal(g); setOwned([]); }}
                className={`flex-1 h-10 rounded-full border text-sm font-medium ${goal === g ? "bg-brand text-white border-brand" : "border-line"}`}>
                {GOALS[g].label}
              </button>
            ))}
          </div>
          <p className="text-sm text-muted mt-2">{GOALS[goal].blurb}</p>
        </div>

        <div>
          <label htmlFor="weeks" className="text-sm text-muted">Weeks until you start</label>
          <select id="weeks" value={weeks} onChange={(e) => setWeeks(Number(e.target.value))}
            className="mt-1 w-full border border-line rounded-lg px-3 py-2.5 bg-white">
            {Array.from({ length: 12 }, (_, i) => i + 1).map((w) => <option key={w} value={w}>{w} week{w > 1 ? "s" : ""}</option>)}
          </select>
        </div>

        <div>
          <p className="text-sm text-muted mb-2">Budget for new gear</p>
          <div className="flex gap-2">
            {[...new Set([...BUDGETS, budget])].sort((a, b) => a - b).map((b) => (
              <button key={b} onClick={() => setBudget(b)}
                className={`flex-1 h-10 rounded-full border text-sm font-medium ${budget === b ? "bg-brand text-white border-brand" : "border-line"}`}>
                {inr(b)}
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className="text-sm text-muted mb-2">Already own?</p>
          <div className="space-y-2">
            {GOALS[goal].needs.map((n) => (
              <label key={n.id} className="flex items-center gap-3 text-[15px]">
                <input type="checkbox" checked={owned.includes(n.id)} onChange={() => toggleOwned(n.id)} className="w-4 h-4" />
                {n.label}
              </label>
            ))}
          </div>
        </div>
      </section>

      <div>
      <section className="px-4 pt-4 lg:px-0 lg:pt-0">
        <div className={`rounded-xl p-4 ${plan.over ? "bg-[#fdecea] text-[#8a2a20]" : "bg-white"}`}>
          <p className="font-semibold">Total for new gear: {inr(plan.total)}</p>
          <p className="text-sm mt-1">
            {plan.over
              ? `${inr(plan.over)} over your ${inr(budget)} budget. Pick a higher budget or mark something you own.`
              : `Within your ${inr(budget)} budget.`}
          </p>
        </div>
        {plan.unavailable.length > 0 && (
          <p className="text-sm text-muted mt-2">Not in stock right now: {plan.unavailable.map((n) => n.label).join(", ")}.</p>
        )}
      </section>

      <section className="px-4 pt-4 space-y-4 lg:px-0">
        {plan.weeks.map((w) => (
          <div key={w.week} className="relative pl-6 border-l-2 border-line">
            <span className="absolute -left-[7px] top-1 w-3 h-3 rounded-full bg-brand" />
            <div className="flex items-baseline justify-between">
              <p className="font-semibold">Week {w.week}</p>
              {w.cost > 0 && <p className="text-sm text-muted">{inr(w.cost)}</p>}
            </div>
            {w.lines.length === 0 && <p className="text-sm text-muted mt-1">Nothing to buy this week.</p>}
            <div className="space-y-2 mt-2">
              {w.lines.map((l) => (
                <div key={l.need.id} className="bg-white rounded-xl p-3 flex gap-3">
                  {l.product ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={img(l.product.images[0], 160)} alt="" className="w-16 h-16 object-contain mix-blend-multiply bg-[#F5F4F5] rounded" />
                  ) : (
                    <div className="w-16 h-16 bg-[#F5F4F5] rounded" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-muted">{l.need.label}{l.need.essential ? "" : " · optional"}</p>
                    {l.owned ? (
                      <p className="font-medium text-[#3d9a6d]">Already owned</p>
                    ) : l.product ? (
                      <>
                        <Link href={`/p/${l.product.id}`} className="font-medium text-[14px] line-clamp-2 block">{l.product.shortName}</Link>
                        <p className="text-sm font-semibold mt-0.5">{inr(l.product.price)}</p>
                        <p className="text-xs text-muted mt-1">{l.need.why}</p>
                        <div className="mt-2">
                          {l.product.sizes.length > 1 ? (
                            <Link href={`/p/${l.product.id}`} className="text-sm text-brand underline">Choose size</Link>
                          ) : inCart(l) ? (
                            <span className="text-sm text-[#3d9a6d]">In your cart</span>
                          ) : (
                            <button onClick={() => { addToCart(l.product!.id, l.product!.sizes[0] ?? null); showToast("Added to cart"); }}
                              className="text-sm text-brand underline">Add to cart</button>
                          )}
                        </div>
                      </>
                    ) : (
                      <p className="text-sm text-muted">No stock for this item right now.</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </section>

      </div>
      </div>

      <div className="bottom-bar lg:hidden fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[440px] bg-white border-t border-line flex items-center gap-4 px-4 py-3 z-30">
        <div><p className="font-bold text-lg">{inr(plan.total)}</p><p className="text-xs text-muted">For {plan.lines.filter((l) => !l.owned && l.product).length} new item(s)</p></div>
        <Link href="/cart" className="flex-1 h-[52px] rounded-full bg-brand text-white font-medium text-[17px] grid place-items-center">View cart</Link>
      </div>
    </main>
  );
}
