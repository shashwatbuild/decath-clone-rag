"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { img, inr } from "@/lib/products";
import { useStore } from "@/lib/store";
import { GOALS, buildPlan, type Goal, type PlanLine } from "@/lib/plan";
import { TopBar } from "@/components/ui";
import ToolIntro from "@/components/ToolIntro";

const BUDGETS = [3000, 5000, 10000];
const sportName = (goal: Goal) => goal === "running" ? "Running" : GOALS[goal].label;

export default function PlanPage() {
  const { addToCart, cart, showToast } = useStore();
  const [goal, setGoal] = useState<Goal>("badminton");
  const [weeks, setWeeks] = useState(4);
  const [budget, setBudget] = useState(5000);
  const [owned, setOwned] = useState<string[]>([]);

  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const g = q.get("goal");
    if (g && g in GOALS) setGoal(g as Goal);
    if (g && Object.hasOwn(GOALS, g)) {
      const valid = new Set(GOALS[g as Goal].needs.map(n => n.id));
      setOwned((q.get("owned") ?? "").split(",").filter(id => valid.has(id)));
    }
    const w = Number(q.get("weeks"));
    if (w >= 1 && w <= 12) setWeeks(w);
    const b = Number(q.get("budget"));
    if (b >= 500) setBudget(b);
  }, []);

  const plan = useMemo(() => buildPlan({ goal, weeks, budget, owned }), [goal, weeks, budget, owned]);
  const inCart = (line: PlanLine) => !!line.product && cart.some((c) => c.id === line.product!.id);
  const newItems = plan.lines.filter((line) => !line.owned && line.product).length;

  function toggleOwned(id: string) {
    setOwned((o) => (o.includes(id) ? o.filter((x) => x !== id) : [...o, id]));
  }

  return (
    <main className="planning-page pb-32 lg:pb-12 min-h-[var(--app-h)]">
      <TopBar title="Training plan" />
      <div className="tool-page-content">
        <ToolIntro kind="plan" />
        <div className="plan-layout">
          <section id="plan-settings" tabIndex={-1} className="plan-settings tool-card" aria-labelledby="plan-settings-title">
            <h2 id="plan-settings-title">Build your gear plan</h2>
            <p className="tool-section-hint">Your timeline updates as you make changes.</p>
            <fieldset className="plan-field">
              <legend>Choose your sport</legend>
              <div className="plan-sports">
                {(Object.keys(GOALS) as Goal[]).map((g) => <button key={g} aria-pressed={goal === g} onClick={() => { setGoal(g); setOwned([]); }} className={`plan-choice ${goal === g ? "plan-choice-active" : ""}`}>{sportName(g)}</button>)}
              </div>
              <p className="tool-field-hint">{GOALS[goal].blurb}</p>
            </fieldset>
            <div className="plan-field">
              <label htmlFor="weeks">Spread purchases over</label>
              <select id="weeks" value={weeks} onChange={(e) => setWeeks(Number(e.target.value))} className="lab-input">
                {Array.from({ length: 12 }, (_, i) => i + 1).map((w) => <option key={w} value={w}>{w} week{w > 1 ? "s" : ""}</option>)}
              </select>
            </div>
            <fieldset className="plan-field">
              <legend>Budget for new gear</legend>
              <div className="plan-budgets">
                {[...new Set([...BUDGETS, budget])].sort((a, b) => a - b).map((b) => <button key={b} aria-pressed={budget === b} onClick={() => setBudget(b)} className={`plan-choice ${budget === b ? "plan-choice-active" : ""}`}>{inr(b)}</button>)}
              </div>
            </fieldset>
            <fieldset className="plan-field">
              <legend>Gear you already have</legend>
              <p className="tool-field-hint mt-0">These items will not count towards new purchases.</p>
              <div className="plan-owned">
                {GOALS[goal].needs.map((need) => <label key={need.id} className={owned.includes(need.id) ? "plan-owned-selected" : ""}><input type="checkbox" checked={owned.includes(need.id)} onChange={() => toggleOwned(need.id)} />{need.label}</label>)}
              </div>
            </fieldset>
            <a href="#gear-timeline" className="tool-primary plan-see-timeline">See my timeline</a>
          </section>

          <div id="gear-timeline" tabIndex={-1} className="plan-results">
            <section className="tool-card plan-summary" aria-label="Plan summary" aria-live="polite" aria-atomic="true">
              <div className="plan-summary-top"><div><p className="tool-section-hint">Your {sportName(goal).toLowerCase()} gear timeline</p><h2>{weeks} weeks · {newItems} new {newItems === 1 ? "item" : "items"}</h2></div><div className="plan-total"><span>Total for new gear</span><strong>{inr(plan.total)}</strong></div></div>
              <p className={`plan-budget-status ${plan.over ? "plan-budget-over" : ""}`}>{plan.over ? `${inr(plan.over)} over your ${inr(budget)} budget. Mark gear you own or adjust your budget.` : `${inr(Math.max(0, budget - plan.total))} left within your ${inr(budget)} budget.`}</p>
              {plan.unavailable.length > 0 && <p className="tool-field-hint">Not in stock right now: {plan.unavailable.map((need) => need.label).join(", ")}.</p>}
            </section>
            <section className="plan-timeline" aria-label="Weekly gear purchases">
              {plan.weeks.map((week) => <section key={week.week} className={`plan-week ${week.lines.length ? "tool-card" : "plan-week-empty"}`} aria-label={`Week ${week.week}`}>
                <div className="plan-week-heading"><h3><span className="plan-week-dot" aria-hidden="true" />Week {week.week}</h3>{week.cost > 0 && <span>{inr(week.cost)}</span>}</div>
                {week.lines.length === 0 ? <p className="tool-section-hint">No new purchases this week.</p> : <div className="plan-week-items">{week.lines.map((line) => <div key={line.need.id} className={`plan-item ${line.owned ? "plan-item-owned" : ""}`}>
                  {!line.owned && <div className="plan-item-image">{line.product && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={img(line.product.images[0], 160)} alt="" />
                  )}</div>}
                  <div className="plan-item-copy"><p className="plan-item-category">{line.need.label}<span>{line.need.essential ? "Essential" : "Optional"}</span></p>
                    {line.owned ? <p className="plan-owned-message">Already owned · no purchase needed</p> : line.product ? <><Link href={`/p/${line.product.id}`} className="plan-product-name">{line.product.shortName}</Link><p className="plan-item-price">{inr(line.product.price)}</p><p className="tool-field-hint">{line.need.why}</p></> : <p className="tool-field-hint">No stock for this item right now.</p>}
                  </div>
                  {!line.owned && line.product && <div className="plan-item-action">{line.product.sizes.length > 1 ? <Link href={`/p/${line.product.id}`} className="lab-button">Choose size</Link> : inCart(line) ? <span className="plan-owned-message">In your cart</span> : <button onClick={() => { addToCart(line.product!.id, line.product!.sizes[0] ?? null); showToast("Added to cart"); }} className="lab-button">Add to cart</button>}</div>}
                </div>)}</div>}
              </section>)}
            </section>
          </div>
        </div>
      </div>
      <div className="bottom-bar lg:hidden fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[440px] bg-white border-t border-line flex items-center gap-4 px-4 py-3 z-30">
        <div><p className="font-bold text-lg">{inr(plan.total)}</p><p className="text-xs text-muted">For {newItems} new {newItems === 1 ? "item" : "items"}</p></div>
        <Link href="/cart" className="flex-1 h-[48px] rounded-xl bg-brand text-white font-medium text-[15px] grid place-items-center">View cart</Link>
      </div>
    </main>
  );
}
