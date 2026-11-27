"use client";
/* eslint-disable @next/next/no-img-element -- display unmodified public catalogue photographs */
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { GOALS } from "@/lib/plan";
import { getProduct, img, inr, toLite } from "@/lib/products";
import {
  adventurePlan,
  isGoal,
  localDate,
  sportFor,
  type Adventure,
} from "@/lib/experiences/model";
import { useExperiences } from "@/lib/experiences/store";
import { useLab } from "@/lib/lab/store";
import { useStore } from "@/lib/store";
import LabProduct from "@/components/lab/LabProduct";
import ExperienceShell, {
  Progress,
  SportChoices,
  Stepper,
  downloadText,
} from "./ExperienceShell";
const initial: Adventure = {
  id: "",
  goal: "badminton",
  budget: 5000,
  date: "",
  owned: [],
  checked: [],
  updatedAt: "",
};
export default function AdventurePlanner() {
  const params = useSearchParams(),
    { data, ready, commit } = useExperiences(),
    { state: lab } = useLab(),
    { showToast } = useStore();
  const [draft, setDraft] = useState<Adventure>(initial),
    [step, setStep] = useState(0),
    [today, setToday] = useState(""),
    [saved, setSaved] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    setToday(localDate());
    const goal = params.get("sport");
    if (isGoal(goal)) setDraft((d) => ({ ...d, goal }));
  }, [params]);
  const sport = sportFor(draft.goal),
    plan = adventurePlan(draft);
  const tasks = [...sport.checks, "Review the kit and reuse what you own"];
  const patch = (change: Partial<Adventure>) => {
    setDraft((d) => ({ ...d, ...change }));
    setSaved(false);
  };
  function move(next: number) {
    setStep(next);
    requestAnimationFrame(() => heading.current?.focus());
  }
  function save() {
    const entry = {
      ...draft,
      id: draft.id || crypto.randomUUID(),
      updatedAt: new Date().toISOString(),
    };
    if (
      commit((current) => ({
        ...current,
        adventures: [
          entry,
          ...current.adventures.filter((a) => a.id !== entry.id),
        ].slice(0, 12),
      }))
    ) {
      setDraft(entry);
      setSaved(true);
      showToast("Adventure saved on this device");
    }
  }
  function useOwned() {
    const available = new Set(
      lab.gear.filter((g) => g.condition === "good").map((g) => g.productId),
    );
    const owned = GOALS[draft.goal].needs
      .filter((n) =>
        lab.gear.some(
          (g) =>
            available.has(g.productId) &&
            getProduct(g.productId)?.category === n.category,
        ),
      )
      .map((n) => n.id);
    patch({ owned: [...new Set([...draft.owned, ...owned])] });
    showToast(
      owned.length
        ? "Usable matching gear included"
        : "No exact matching gear found. Mark what you own below.",
    );
  }
  return (
    <ExperienceShell
      active="/adventures"
      title="Plan my next adventure"
      lead="A little planning. A lot to look forward to."
      description="Pick your next activity, reuse your gear and build a checklist you can actually follow."
    >
      <Stepper
        step={step}
        steps={["Choose your moment", "Make it yours", "Your adventure"]}
        onStep={move}
      />
      <div className="experience-layout">
        <section className="experience-main experience-card">
          <div className="experience-section-heading">
            <div>
              <span className="experience-label">Step {step + 1} of 3</span>
              <h3 ref={heading} tabIndex={-1}>
                {step === 0
                  ? "What would you like to try?"
                  : step === 1
                    ? "Bring what you have. Add what you need."
                    : "Your plan, ready to make your own."}
              </h3>
            </div>
            <span className="experience-count">
              {String(step + 1).padStart(2, "0")}
            </span>
          </div>
          {step === 0 ? (
            <div className="experience-stage-content">
              <SportChoices
                value={draft.goal}
                onChange={(goal) => patch({ goal, owned: [], checked: [] })}
              />
              <div
                className="adventure-scene"
                style={{ background: sport.accent }}
              >
                <span className="adventure-route" aria-hidden />
                <div>
                  <p>{sport.name}</p>
                  <h4>{sport.title}</h4>
                  <p>{sport.description}</p>
                </div>
                <span className="adventure-scene-tag">
                  Made for a first step
                </span>
              </div>
              <div className="experience-form-grid">
                <label className="lab-label">
                  When are you thinking?
                  <input
                    className="lab-input"
                    type="date"
                    min={today}
                    value={draft.date}
                    onChange={(e) => patch({ date: e.target.value })}
                  />
                  <span>You can leave the date open.</span>
                </label>
                <label className="lab-label">
                  Budget for new gear
                  <input
                    className="lab-input"
                    type="number"
                    min="500"
                    max="100000"
                    step="100"
                    value={draft.budget}
                    onChange={(e) =>
                      patch({
                        budget: Math.max(
                          500,
                          Math.min(100000, Number(e.target.value) || 500),
                        ),
                      })
                    }
                  />
                </label>
              </div>
              <div className="experience-chips" aria-label="Quick budgets">
                {[3000, 5000, 8000].map((b) => (
                  <button
                    key={b}
                    aria-pressed={draft.budget === b}
                    onClick={() => patch({ budget: b })}
                  >
                    {inr(b)}
                  </button>
                ))}
              </div>
            </div>
          ) : step === 1 ? (
            <div className="experience-stage-content">
              <p className="experience-muted">
                Mark the categories you already have. They will be excluded from
                new purchases.
              </p>
              <div className="adventure-owned">
                {GOALS[draft.goal].needs.map((n) => (
                  <label
                    key={n.id}
                    className={draft.owned.includes(n.id) ? "is-owned" : ""}
                  >
                    <input
                      type="checkbox"
                      aria-label={n.label}
                      checked={draft.owned.includes(n.id)}
                      onChange={() =>
                        patch({
                          owned: draft.owned.includes(n.id)
                            ? draft.owned.filter((id) => id !== n.id)
                            : [...draft.owned, n.id],
                        })
                      }
                    />
                    <span>
                      <strong>{n.label}</strong>
                      <small>
                        {draft.owned.includes(n.id)
                          ? "I can reuse this"
                          : n.essential
                            ? "Core kit"
                            : "Optional extra"}
                      </small>
                    </span>
                    <span aria-hidden>
                      {draft.owned.includes(n.id) ? "✓" : "+"}
                    </span>
                  </label>
                ))}
              </div>
              <button className="experience-text-button" onClick={useOwned}>
                Check my Gear Lab inventory
              </button>
              <p className="experience-muted">
                Reuse items that are suitable and in good condition. Borrowing
                is an option too.
              </p>
            </div>
          ) : (
            <div className="experience-stage-content">
              <Progress
                done={tasks.filter((t) => draft.checked.includes(t)).length}
                total={tasks.length}
                label="Ready for your activity"
              />
              <div className="experience-checklist">
                {tasks.map((t) => (
                  <label key={t}>
                    <input
                      type="checkbox"
                      checked={draft.checked.includes(t)}
                      onChange={() =>
                        patch({
                          checked: draft.checked.includes(t)
                            ? draft.checked.filter((c) => c !== t)
                            : [...draft.checked, t],
                        })
                      }
                    />
                    <span>{t}</span>
                  </label>
                ))}
              </div>
              <div className="experience-inline-note">
                {draft.goal === "trekking"
                  ? "This catalogue kit is a starting point for an easy day walk, not a complete hiking or safety checklist. Confirm route-specific needs."
                  : "This is a preparation and shopping plan. Confirm your venue or route and any activity-specific requirements."}
              </div>
              <div className="experience-section-heading mt-6">
                <h3>Your kit</h3>
                <span className="experience-muted">
                  {draft.owned.length}{" "}
                  {draft.owned.length === 1 ? "category" : "categories"} to
                  reuse
                </span>
              </div>
              <div className="adventure-kit">
                {plan.lines.map((l) => (
                  <div key={l.need.id} className="adventure-kit-line">
                    <div className="adventure-kit-label">
                      <strong>{l.need.label}</strong>
                      <span>
                        {l.owned
                          ? "Reuse yours"
                          : l.need.essential
                            ? "Core kit"
                            : "Optional"}
                      </span>
                    </div>
                    {l.owned ? (
                      <p className="experience-reuse">
                        ✓ No new purchase counted
                      </p>
                    ) : l.product ? (
                      <LabProduct
                        product={{
                          ...toLite(l.product),
                          sizes: l.product.sizes,
                          inStock: l.product.inStock,
                          weightKg: l.product.weightKg,
                        }}
                      />
                    ) : (
                      <p className="experience-muted">
                        Not available in this catalogue.
                      </p>
                    )}
                  </div>
                ))}
              </div>
              <Link
                className="experience-text-button"
                href={`/guides/${sport.guide}`}
              >
                Read the {sport.name.toLowerCase()} buying guide →
              </Link>
            </div>
          )}
          <div className="experience-actions">
            {step > 0 && (
              <button className="lab-button" onClick={() => move(step - 1)}>
                Back
              </button>
            )}
            {step < 2 ? (
              <button className="tool-primary" onClick={() => move(step + 1)}>
                {step === 0 ? "Make it mine" : "Build my adventure"}{" "}
                <span aria-hidden>→</span>
              </button>
            ) : (
              <>
                <button
                  className="tool-primary"
                  disabled={!ready}
                  onClick={save}
                >
                  {saved ? "Saved on this device ✓" : "Save my adventure"}
                </button>
                <button
                  className="lab-button"
                  onClick={() =>
                    downloadText(
                      `${sport.title}\n${draft.date || "Date to decide"}\n\nChecklist\n${tasks.map((t) => `${draft.checked.includes(t) ? "[x]" : "[ ]"} ${t}`).join("\n")}\n\nKit\n${plan.lines.map((l) => `${l.need.label}: ${l.owned ? "Reuse yours" : l.product ? `${l.product.shortName} — ${inr(l.product.price)}` : "Not in catalogue"}`).join("\n")}\nNew gear total: ${inr(plan.total)}\nNo activity booking has been made.`,
                      "my-adventure.txt",
                      "text/plain",
                    )
                  }
                >
                  Download checklist
                </button>
              </>
            )}
          </div>
        </section>
        <aside className="experience-aside">
          <section className="experience-card adventure-summary">
            <span className="experience-label">Your adventure at a glance</span>
            <h3>{sport.title}</h3>
            <div className="adventure-summary-date">
              {draft.date
                ? new Date(`${draft.date}T12:00:00`).toLocaleDateString(
                    "en-IN",
                    { day: "numeric", month: "short", year: "numeric" },
                  )
                : "A date that works for you"}
            </div>
            <div className="adventure-mini-kit" aria-hidden>
              {plan.lines
                .filter((l) => l.product)
                .slice(0, 3)
                .map((l) => (
                  <div key={l.need.id}>
                    <img src={img(l.product!.images[0], 160)} alt="" />
                  </div>
                ))}
            </div>
            <div className="experience-total">
              <span>New gear total</span>
              <strong>{inr(plan.total)}</strong>
            </div>
            <p
              className={
                plan.over ? "experience-budget-over" : "experience-muted"
              }
              role="status"
            >
              {plan.over
                ? `${inr(plan.over)} over budget. Reuse more or adjust your budget.`
                : `${inr(draft.budget - plan.total)} left in your gear budget.`}
            </p>
            <Link
              href={`/try-sport?sport=${draft.goal}`}
              className="lab-button w-full mt-5"
            >
              Try it before buying →
            </Link>
            <Link
              className="experience-text-button"
              href={`/plan?goal=${draft.goal}&budget=${draft.budget}&owned=${draft.owned.join(",")}`}
            >
              Spread purchases over weeks
            </Link>
          </section>
          {data.adventures.length > 0 && (
            <section className="experience-card">
              <h3>Pick up where you left off</h3>
              <div className="experience-saved-list">
                {data.adventures.map((a) => (
                  <div key={a.id}>
                    <button
                      onClick={() => {
                        setDraft(a);
                        setStep(2);
                        setSaved(true);
                      }}
                    >
                      <strong>{sportFor(a.goal).title}</strong>
                      <span>
                        {a.date || "Date open"} · {inr(a.budget)} budget
                      </span>
                    </button>
                    <button
                      aria-label={`Remove ${sportFor(a.goal).title}`}
                      className="experience-remove"
                      onClick={() =>
                        commit(
                          (c) => ({
                            ...c,
                            adventures: c.adventures.filter(
                              (x) => x.id !== a.id,
                            ),
                          }),
                          true,
                        )
                      }
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            </section>
          )}
        </aside>
      </div>
    </ExperienceShell>
  );
}
