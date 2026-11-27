"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  isGoal,
  localDate,
  sportFor,
  trialAgenda,
  trialCalendar,
  validDate,
  validTime,
  venueSearch,
  type Trial,
} from "@/lib/experiences/model";
import { useExperiences } from "@/lib/experiences/store";
import { useStore } from "@/lib/store";
import ExperienceShell, {
  Progress,
  SportChoices,
  downloadText,
} from "./ExperienceShell";
const empty: Trial = {
  id: "",
  goal: "badminton",
  mode: "friend",
  city: "",
  date: "",
  time: "10:00",
  minutes: 45,
  checked: [],
  status: "planned",
  enjoyment: 0,
  reflection: "",
  updatedAt: "",
};
export default function TrySport() {
  const params = useSearchParams(),
    { data, ready, commit } = useExperiences(),
    { showToast } = useStore();
  const [draft, setDraft] = useState<Trial>(empty),
    [today, setToday] = useState(""),
    [panel, setPanel] = useState<"plan" | "reflect">("plan"),
    [saveMessage, setSaveMessage] = useState("");
  useEffect(() => {
    setToday(localDate());
    const goal = params.get("sport");
    if (isGoal(goal)) setDraft((d) => ({ ...d, goal }));
  }, [params]);
  const sport = sportFor(draft.goal),
    checks = [...sport.checks, "Decide what to borrow or bring"];
  const canSave =
    validDate(draft.date) && validTime(draft.time) && draft.date >= today;
  const patch = (change: Partial<Trial>) => {
    setDraft((d) => ({ ...d, ...change }));
    setSaveMessage("");
  };
  function save(status: Trial["status"] = draft.status) {
    if (
      !validDate(draft.date) ||
      !validTime(draft.time) ||
      (status === "planned" && draft.date < today) ||
      (status === "tried" && draft.date > today)
    ) {
      setSaveMessage("Choose a date and time first.");
      return;
    }
    const entry = {
      ...draft,
      status,
      id: draft.id || crypto.randomUUID(),
      updatedAt: new Date().toISOString(),
    };
    if (
      commit((c) => ({
        ...c,
        trials: [entry, ...c.trials.filter((t) => t.id !== entry.id)].slice(
          0,
          12,
        ),
      }))
    ) {
      setDraft(entry);
      setSaveMessage(
        status === "tried"
          ? "Your experience is saved. Ready for another step?"
          : "Personal plan saved. Confirm any venue booking separately.",
      );
      showToast(
        status === "tried" ? "Trial reflection saved" : "Trial plan saved",
      );
    }
  }
  function calendar() {
    const entry = { ...draft, id: draft.id || crypto.randomUUID() };
    setDraft(entry);
    downloadText(
      trialCalendar(entry),
      "my-sport-trial.ics",
      "text/calendar;charset=utf-8",
    );
  }
  return (
    <ExperienceShell
      active="/try-sport"
      title="Try a sport"
      lead="Try the feeling. Then choose the kit."
      description="Plan a low-commitment first session, find somewhere to try it and reflect before you buy."
    >
      <div className="experience-layout">
        <section className="experience-main experience-card">
          <div className="experience-section-heading">
            <h3>What are you curious about?</h3>
            <span className="experience-pill">Start with what you own</span>
          </div>
          <SportChoices
            value={draft.goal}
            onChange={(goal) => {
              patch({
                goal,
                checked: [],
                status: "planned",
                enjoyment: 0,
                reflection: "",
                id: "",
              });
              setPanel("plan");
            }}
          />
          <div
            className="experience-segmented"
            role="group"
            aria-label="Trial stage"
          >
            <button
              aria-pressed={panel === "plan"}
              onClick={() => setPanel("plan")}
            >
              Plan a first session
            </button>
            <button
              aria-pressed={panel === "reflect"}
              onClick={() => setPanel("reflect")}
            >
              After I try it
            </button>
          </div>
          {panel === "plan" ? (
            <div className="experience-stage-content">
              <h3>Make the first step easy</h3>
              <div
                className="trial-modes"
                role="group"
                aria-label="How would you like to try it?"
              >
                {(
                  [
                    {
                      id: "friend",
                      name: "With a friend",
                      body: "Arrange a relaxed introduction and borrow suitable kit.",
                    },
                    {
                      id: "class",
                      name: "With an instructor",
                      body: "Find a beginner session and confirm the details directly.",
                    },
                  ] as const
                ).map((m) => (
                  <button
                    key={m.id}
                    aria-pressed={draft.mode === m.id}
                    onClick={() => patch({ mode: m.id })}
                  >
                    <span className="trial-radio" aria-hidden>
                      {draft.mode === m.id ? "●" : "○"}
                    </span>
                    <strong>{m.name}</strong>
                    <span>{m.body}</span>
                  </button>
                ))}
              </div>
              <div className="trial-borrow-note">
                <span aria-hidden>↺</span>
                <p>{sport.kit}</p>
              </div>
              <div className="experience-form-grid">
                <label className="lab-label">
                  Your city or area
                  <input
                    className="lab-input"
                    maxLength={80}
                    placeholder="e.g. Pune"
                    value={draft.city}
                    onChange={(e) => patch({ city: e.target.value })}
                  />
                </label>
                <div className="trial-discovery">
                  <span>Find a place to start</span>
                  {draft.city.trim() ? (
                    <a
                      className="lab-button"
                      href={venueSearch(draft.goal, draft.city)}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Explore on Google Maps ↗
                    </a>
                  ) : (
                    <p className="experience-muted">
                      Enter a city to explore nearby options.
                    </p>
                  )}
                </div>
              </div>
              <p className="experience-muted">
                Opens an external search. Availability, fees, equipment and
                bookings are confirmed with the venue.
              </p>
              <div className="experience-form-grid">
                <label className="lab-label">
                  Preferred date
                  <input
                    className="lab-input"
                    type="date"
                    min={today}
                    value={draft.date}
                    onChange={(e) => patch({ date: e.target.value })}
                  />
                </label>
                <label className="lab-label">
                  Preferred time
                  <input
                    className="lab-input"
                    type="time"
                    value={draft.time}
                    onChange={(e) => patch({ time: e.target.value })}
                  />
                </label>
              </div>
              <fieldset className="experience-fieldset">
                <legend>Time you want to set aside</legend>
                <div className="experience-chips">
                  {([30, 45, 60] as const).map((m) => (
                    <button
                      key={m}
                      aria-pressed={draft.minutes === m}
                      onClick={() => patch({ minutes: m })}
                    >
                      {m} minutes
                    </button>
                  ))}
                </div>
              </fieldset>
              <div
                className="trial-agenda"
                aria-label="Your suggested session structure"
              >
                {trialAgenda(draft.minutes).map((a, i) => (
                  <div key={a.title}>
                    <span className="trial-agenda-dot">{i + 1}</span>
                    <div>
                      <strong>{a.title}</strong>
                      <p>
                        {i === 0
                          ? "Meet, check the space and ask about equipment."
                          : i === 1
                            ? "Follow the instructor or keep the introduction comfortable."
                            : "Notice what you enjoyed and what you would change."}
                      </p>
                    </div>
                    <span>{a.minutes} min</span>
                  </div>
                ))}
              </div>
              <p className="experience-muted">
                A flexible time outline, not a workout prescription. Follow your
                instructor where applicable.
              </p>
            </div>
          ) : (
            <div className="experience-stage-content">
              <h3>How did it feel?</h3>
              <label className="lab-label mt-4 mb-4">
                Date you tried it
                <input
                  className="lab-input"
                  type="date"
                  max={today}
                  value={draft.date}
                  onChange={(e) => patch({ date: e.target.value })}
                />
              </label>
              <p className="experience-muted">
                After your real session, record what you enjoyed. There is no
                pressure to buy anything.
              </p>
              <fieldset className="experience-fieldset">
                <legend>Would you like to do it again?</legend>
                <div
                  className="trial-rating"
                  role="group"
                  aria-label="Enjoyment rating"
                >
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button
                      key={n}
                      aria-label={`${n} out of 5`}
                      aria-pressed={draft.enjoyment === n}
                      onClick={() => patch({ enjoyment: n })}
                    >
                      <span>{n}</span>
                      <small>
                        {n === 1
                          ? "Not for me"
                          : n === 3
                            ? "Maybe"
                            : n === 5
                              ? "Loved it"
                              : ""}
                      </small>
                    </button>
                  ))}
                </div>
              </fieldset>
              <label className="lab-label">
                What would make next time better?
                <textarea
                  className="lab-input min-h-28"
                  maxLength={300}
                  placeholder="What felt good? Was there anything you wanted to borrow or change?"
                  value={draft.reflection}
                  onChange={(e) => patch({ reflection: e.target.value })}
                />
              </label>
              <div className="trial-next-step">
                <h4>
                  {draft.enjoyment >= 4
                    ? "Sounds like a promising next chapter."
                    : draft.enjoyment > 0
                      ? "Your first try is useful, whatever comes next."
                      : "Try it first. Decide afterwards."}
                </h4>
                <p>
                  {draft.enjoyment >= 4
                    ? "Plan another session and build around the gear you already own."
                    : "Keep your notes, try a different format or explore another sport."}
                </p>
                <Link
                  className="lab-button"
                  href={`/adventures?sport=${draft.goal}`}
                >
                  Plan my next step →
                </Link>
              </div>
              {!draft.date && (
                <p className="experience-inline-note">
                  Choose the date you tried it above before saving your
                  reflection.
                </p>
              )}
            </div>
          )}
          <div className="experience-actions">
            {panel === "plan" ? (
              <>
                <button
                  className="tool-primary"
                  disabled={!ready || !canSave}
                  onClick={() => save("planned")}
                >
                  Save my trial plan
                </button>
                <button
                  className="lab-button"
                  disabled={!canSave}
                  onClick={calendar}
                >
                  Add to my calendar
                </button>
              </>
            ) : (
              <button
                className="tool-primary"
                disabled={
                  !ready ||
                  !validDate(draft.date) ||
                  draft.date > today ||
                  !draft.enjoyment
                }
                onClick={() => save("tried")}
              >
                Save my reflection
              </button>
            )}
          </div>
          {saveMessage && (
            <p role="status" className="experience-save-message">
              {saveMessage}
            </p>
          )}
        </section>
        <aside className="experience-aside">
          <section className="experience-card">
            <span className="experience-label">Before you go</span>
            <h3>Less shopping. More trying.</h3>
            <Progress
              done={checks.filter((c) => draft.checked.includes(c)).length}
              total={checks.length}
              label="First-session checklist"
            />
            <div className="experience-checklist">
              {checks.map((c) => (
                <label key={c}>
                  <input
                    type="checkbox"
                    checked={draft.checked.includes(c)}
                    onChange={() =>
                      patch({
                        checked: draft.checked.includes(c)
                          ? draft.checked.filter((v) => v !== c)
                          : [...draft.checked, c],
                      })
                    }
                  />
                  <span>{c}</span>
                </label>
              ))}
            </div>
            <p className="experience-inline-note">
              Saving a trial creates a personal plan, not a booking. No
              equipment or instructor is reserved.
            </p>
            <Link
              className="experience-text-button"
              href={`/guides/${sport.guide}`}
            >
              Get familiar with the gear →
            </Link>
          </section>
          {data.trials.length > 0 && (
            <section className="experience-card">
              <h3>Your trial journal</h3>
              <div className="experience-saved-list">
                {data.trials.map((t) => (
                  <div key={t.id}>
                    <button
                      onClick={() => {
                        setDraft(t);
                        setPanel(t.status === "tried" ? "reflect" : "plan");
                        setSaveMessage("");
                      }}
                    >
                      <strong>
                        {sportFor(t.goal).name}{" "}
                        <span>
                          {t.status === "tried" ? "Tried it" : "Planned"}
                        </span>
                      </strong>
                      <span>
                        {t.date} · {t.time}
                        {t.enjoyment ? ` · ${t.enjoyment}/5` : ""}
                      </span>
                    </button>
                    <button
                      className="experience-remove"
                      aria-label={`Remove ${sportFor(t.goal).name} trial`}
                      onClick={() =>
                        commit(
                          (c) => ({
                            ...c,
                            trials: c.trials.filter((x) => x.id !== t.id),
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
