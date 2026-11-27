"use client";
import Link from "next/link";
import { TopBar } from "@/components/ui";
import { SPORTS } from "@/lib/experiences/model";
import { useExperiences } from "@/lib/experiences/store";
import type { Goal } from "@/lib/plan";
import type { ReactNode } from "react";
export const PATHS = [
  { href: "/adventures", label: "Plan an adventure" },
  { href: "/try-sport", label: "Try a sport" },
  { href: "/fit", label: "My fit memories" },
];
export default function ExperienceShell({
  active,
  title,
  lead,
  description,
  children,
}: {
  active: string;
  title: string;
  lead: string;
  description: string;
  children: ReactNode;
}) {
  const { error, undo, canUndo } = useExperiences();
  return (
    <main className="experience-page">
      <TopBar title={title} />
      <div className="experience-container">
        <nav className="experience-nav" aria-label="Sports companion">
          {PATHS.map((p) => (
            <Link
              key={p.href}
              href={p.href}
              aria-current={active === p.href ? "page" : undefined}
            >
              {p.label}
            </Link>
          ))}
        </nav>
        <section className="experience-intro">
          <span className="experience-label">Your next chapter in sport</span>
          <h2>{lead}</h2>
          <p>{description}</p>
        </section>
        {error && (
          <p className="lab-notice mb-4" role="alert">
            {error}
          </p>
        )}
        {canUndo && (
          <div className="experience-undo" role="status">
            <span>Item removed.</span>
            <button onClick={undo}>Undo removal</button>
          </div>
        )}
        {children}
      </div>
    </main>
  );
}
export function SportChoices({
  value,
  onChange,
}: {
  value: Goal;
  onChange: (goal: Goal) => void;
}) {
  return (
    <div className="experience-sports" role="group" aria-label="Choose a sport">
      {SPORTS.map((s, i) => (
        <button
          key={s.id}
          aria-pressed={value === s.id}
          onClick={() => onChange(s.id)}
          className={value === s.id ? "is-selected" : ""}
        >
          <span className={`sport-mark sport-mark-${i}`} aria-hidden>
            <svg viewBox="0 0 64 64" fill="none">
              <path
                d={
                  i === 0
                    ? "M24 35 11 54m16-23c-8-8 4-25 14-20 11 5 6 20-3 24-4 2-8 1-11-4ZM27 16l14 14m-17-6 14 14"
                    : i === 1
                      ? "m8 42 15-6 12 5 20-7v13H8V42Zm15-6 3-13 11 1 6 13M28 31l7 3M29 26l7 3"
                      : i === 2
                        ? "M9 45c13-6 12-17 23-17S42 39 55 45M18 46h28M32 13a5 5 0 1 0 0 10 5 5 0 0 0 0-10Z"
                        : "m7 49 17-30 12 21 7-13 15 22H7Zm12-21 5 4 5-5"
                }
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </span>
          <span>{s.name}</span>
          <span className="sport-selection" aria-hidden>
            {value === s.id ? "✓" : "+"}
          </span>
        </button>
      ))}
    </div>
  );
}
export function Stepper({
  step,
  steps,
  onStep,
}: {
  step: number;
  steps: string[];
  onStep: (step: number) => void;
}) {
  return (
    <nav className="experience-steps" aria-label="Your progress">
      {steps.map((s, i) => (
        <button
          key={s}
          onClick={() => onStep(i)}
          aria-current={step === i ? "step" : undefined}
          className={step > i ? "is-complete" : ""}
        >
          <span>{step > i ? "✓" : i + 1}</span>
          {s}
        </button>
      ))}
    </nav>
  );
}
export function Progress({
  done,
  total,
  label,
}: {
  done: number;
  total: number;
  label: string;
}) {
  return (
    <div className="experience-progress">
      <div>
        <span>{label}</span>
        <strong>
          {done}/{total}
        </strong>
      </div>
      <progress max={total || 1} value={done} aria-label={label} />
    </div>
  );
}
export function ToggleChips({
  options,
  value,
  onChange,
  label,
}: {
  options: readonly string[];
  value: string[];
  onChange: (values: string[]) => void;
  label: string;
}) {
  return (
    <div className="experience-chips" role="group" aria-label={label}>
      {options.map((o) => (
        <button
          key={o}
          aria-pressed={value.includes(o)}
          onClick={() =>
            onChange(
              value.includes(o) ? value.filter((v) => v !== o) : [...value, o],
            )
          }
        >
          {value.includes(o) ? "✓ " : ""}
          {o}
        </button>
      ))}
    </div>
  );
}
export function downloadText(text: string, name: string, type: string) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
