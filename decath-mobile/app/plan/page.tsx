"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { img, inr } from "@/lib/products";
import { useStore } from "@/lib/store";
import { GOALS, buildPlan, type Goal, type PlanLine } from "@/lib/plan";
import { TopBar } from "@/components/ui";
import ToolIntro from "@/components/ToolIntro";

const BUDGETS = [3000, 5000, 10000];
const sportName = (goal: Goal) => goal === "running" ? "Running" : GOALS[goal].label;

export default function PlanPage() {
  const router = useRouter();
  const { addToCart, cart, showToast } = useStore();
  const [goal, setGoal] = useState<Goal>("badminton");
  const [weeks, setWeeks] = useState(4);
  const [budget, setBudget] = useState(5000);
  const [owned, setOwned] = useState<string[]>([]);
  const [mobileView, setMobileView] = useState<"setup" | "timeline">("setup");
  const [openWeeks, setOpenWeeks] = useState<number[]>([1]);
  const viewAnchor = useRef<HTMLDivElement>(null);
  function changeView(view: "setup" | "timeline") {
    setMobileView(view);
    const query = new URLSearchParams({ goal, weeks: String(weeks), budget: String(budget), owned: owned.join(","), view });
    router.replace(`/plan?${query}`, { scroll: false });
    requestAnimationFrame(() => {
      const anchor = viewAnchor.current;
      if (!anchor) return;
      const container = anchor.closest<HTMLElement>(".phone-scroll");
      if (container && getComputedStyle(container).overflowY === "auto") {
        container.scrollTo({ top: container.scrollTop + anchor.getBoundingClientRect().top - container.getBoundingClientRect().top - 112, behavior: "auto" });
      } else {
        window.scrollTo({ top: window.scrollY + anchor.getBoundingClientRect().top - 112, behavior: "auto" });
      }
    });
  }

  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const g = q.get("goal");
    if (g && Object.hasOwn(GOALS, g)) setGoal(g as Goal);
    if (g && Object.hasOwn(GOALS, g)) {
      const valid = new Set(GOALS[g as Goal].needs.map(n => n.id));
      setOwned((q.get("owned") ?? "").split(",").filter(id => valid.has(id)));
    }
    const w = Number(q.get("weeks"));
    if (w >= 1 && w <= 12) setWeeks(w);
    const b = Number(q.get("budget"));
    if (b >= 500) setBudget(b);
    if (q.get("view") === "timeline") setMobileView("timeline");
  }, []);

  const plan = useMemo(() => buildPlan({ goal, weeks, budget, owned }), [goal, weeks, budget, owned]);
  const inCart = (line: PlanLine) => !!line.product && cart.some((c) => c.id === line.product!.id);
  const newItems = plan.lines.filter((line) => !line.owned && line.product).length;

  function toggleOwned(id: string) {
    setOwned((o) => (o.includes(id) ? o.filter((x) => x !== id) : [...o, id]));
  }

  return (
    <main className="planning-page pb-32 lg:pb-12 min-h-[var(--app-h)]" data-mobile-view={mobileView}>
      <TopBar title="Training plan" />
      <div className="tool-page-content">
        <ToolIntro kind="plan" />
        <div ref={viewAnchor} className="plan-mobile-anchor" />
        <nav className="plan-mobile-views" aria-label="Gear plan views">
          <button aria-pressed={mobileView === "setup"} onClick={() => changeView("setup")}>Set up</button>
          <button aria-pressed={mobileView === "timeline"} onClick={() => changeView("timeline")}>Weekly plan <span>{weeks}</span></button>
        </nav>
        <div className="plan-layout">
          <section id="plan-settings" tabIndex={-1} className="plan-settings tool-card" aria-labelledby="plan-settings-title">
            <h2 id="plan-settings-title">Make it your plan</h2>
            <p className="tool-section-hint">Your sport, your timing, your budget.</p>
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
            <a href="#gear-timeline" onClick={e => { if (window.matchMedia("(max-width: 1023px)").matches) { e.preventDefault(); changeView("timeline"); } }} className="tool-primary plan-see-timeline">See my weekly plan</a>
          </section>

          <div id="gear-timeline" tabIndex={-1} className="plan-results">
            <section className="tool-card plan-summary" aria-label="Plan summary" aria-live="polite" aria-atomic="true">
              <div className="plan-summary-top"><div><p className="tool-section-hint">Your {sportName(goal).toLowerCase()} gear timeline</p><h2>{weeks} weeks · {newItems} new {newItems === 1 ? "item" : "items"}</h2></div><div className="plan-total"><span>Total for new gear</span><strong>{inr(plan.total)}</strong></div></div>
              <p className={`plan-budget-status ${plan.over ? "plan-budget-over" : ""}`}>{plan.over ? `${inr(plan.over)} over your ${inr(budget)} budget. Mark gear you own or adjust your budget.` : `${inr(Math.max(0, budget - plan.total))} left within your ${inr(budget)} budget.`}</p>
              {plan.unavailable.length > 0 && <p className="tool-field-hint">Not in stock right now: {plan.unavailable.map((need) => need.label).join(", ")}.</p>}
            </section>
            <section className="plan-timeline" aria-label="Weekly gear purchases">
              {plan.weeks.map((week) => <section key={week.week} className={`plan-week ${week.lines.length ? "tool-card" : "plan-week-empty"}`} aria-label={`Week ${week.week}`} data-mobile-expanded={openWeeks.includes(week.week)}>
                <div className="plan-week-heading"><h3><span className="plan-week-dot" aria-hidden="true" />Week {week.week}</h3>{week.cost > 0 && <span>{inr(week.cost)}</span>}</div>
                <button className="plan-week-toggle" aria-expanded={openWeeks.includes(week.week)} aria-controls={`week-items-${week.week}`} onClick={() => setOpenWeeks(current => current.includes(week.week) ? current.filter(w => w !== week.week) : [...current, week.week])}>
                  <span><strong>Week {week.week}</strong><small>{week.lines.some(l => !l.owned && l.product) ? `${week.lines.filter(l => !l.owned && l.product).length} to buy` : week.lines.length ? "Already owned" : "No purchases"}</small></span><span>{week.cost > 0 ? inr(week.cost) : week.lines.length ? "Reuse" : "—"}<span className="plan-week-chevron" aria-hidden>⌄</span></span>
                </button>
                <div id={`week-items-${week.week}`} className="plan-week-content">
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
                </div>
              </section>)}
            </section>
          </div>
        </div>
      </div>
      <div className="bottom-bar plan-mobile-bar lg:hidden fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[440px] bg-white border-t border-line flex items-center gap-4 px-4 py-3 z-30">
        <div><p className="font-bold text-lg">{inr(plan.total)}</p><p className="text-xs text-muted">For {newItems} new {newItems === 1 ? "item" : "items"}</p></div>
        {mobileView === "setup" ? <button className="tool-primary flex-1" onClick={() => changeView("timeline")}>See weekly plan →</button> : <Link href="/cart" className="tool-primary flex-1">View cart</Link>}
      </div>
    </main>
  );
}
