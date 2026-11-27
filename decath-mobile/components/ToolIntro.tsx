import Link from "next/link";
import { IconLab, IconPlan } from "./Icons";

const CONTENT = {
  plan: {
    audience: "For anyone starting a sport or preparing for an event.",
    title: "Know what to buy, and when.",
    description: "Turn your sport, budget and existing gear into a week-by-week shopping list.",
    steps: ["Choose your sport", "Set your timing and budget", "Review your weekly gear list"],
    start: "Set up my plan",
    href: "#plan-settings",
    other: "/lab",
    otherLabel: "Need help choosing? Explore Gear Lab",
  },
  lab: {
    audience: "For beginners, regular players and people shopping for a team.",
    title: "Choose well. Make more of your gear.",
    description: "Compare options, understand each pick and work out what to buy, share or reuse.",
    steps: ["Set your activity and budget", "Pick a tool below", "Decide what to buy or reuse"],
    start: "Set up my activity",
    href: "#lab-settings",
    other: "/plan",
    otherLabel: "Want a weekly shopping list? Open training plan",
  },
};

/** A short, always-visible introduction so a first visit has a clear starting point. */
export default function ToolIntro({ kind, onStart }: { kind: keyof typeof CONTENT; onStart?: () => void }) {
  const content = CONTENT[kind];
  const Icon = kind === "plan" ? IconPlan : IconLab;
  return (
    <>
    <section className="tool-mobile-intro" aria-label={kind === "plan" ? "About training plan" : "About Gear Lab"}>
      <h2>{kind === "plan" ? "Your gear, week by week." : "Make more of your gear."}</h2>
      <p>{kind === "plan" ? "Choose your sport, reuse what you own and plan your next purchases." : "Compare your options, reuse your kit and understand each recommendation."}</p>
      <details><summary>How this works <span aria-hidden>+</span></summary><div><p>{content.audience}</p><ol>{content.steps.map(step => <li key={step}>{step}</li>)}</ol>{kind === "plan" && <p>This plans gear purchases, not workouts.</p>}<Link href={content.other}>{content.otherLabel} →</Link></div></details>
    </section>
    <section className="tool-intro" aria-label={kind === "plan" ? "About training plan" : "About Gear Lab"}>
      <div className="tool-intro-copy">
        <div className="tool-intro-audience"><span className="tool-intro-icon"><Icon /></span><p>{content.audience}</p></div>
        <h2>{content.title}</h2>
        <p className="tool-intro-description">{content.description}</p>
        <ol className="tool-intro-steps">{content.steps.map((step, i) => <li key={step}><span aria-hidden="true">{i + 1}</span>{step}</li>)}</ol>
        {kind === "plan" && <p className="tool-intro-note">This is a gear purchase plan, not a workout schedule.</p>}
      </div>
      <div className="tool-intro-actions">
        {onStart ? <button className="tool-primary" onClick={onStart}>{content.start}</button> : <a className="tool-primary" href={content.href}>{content.start}</a>}
        <Link href={content.other} className="tool-intro-other">{content.otherLabel}</Link>
      </div>
    </section>
    </>
  );
}
