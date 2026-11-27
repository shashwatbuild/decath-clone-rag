import { GOALS, buildPlan, type Goal } from "@/lib/plan";
import { getProduct, products } from "@/lib/products";
export const SPORTS = [
  {
    id: "badminton",
    name: "Badminton",
    title: "Your first rally",
    description: "Try a court session with a friend.",
    guide: "guide-badminton-racket",
    accent: "#e9edfb",
    kit: "Borrow a racket; ask the venue about court shoes and shuttles.",
    search: "beginner badminton coaching courts",
    checks: [
      "Confirm a court and a playing partner",
      "Check the venue’s footwear rules",
      "Confirm whether rackets and shuttles are provided",
    ],
  },
  {
    id: "running",
    name: "Running",
    title: "A little time outside",
    description: "Explore an easy walk or run at your own pace.",
    guide: "guide-running-shoes",
    accent: "#e9f2ec",
    kit: "Start with comfortable, suitable footwear and clothing you own.",
    search: "beginner running club public park",
    checks: [
      "Choose an accessible route and meeting point",
      "Check local conditions before leaving",
      "Plan water and a way to get home",
    ],
  },
  {
    id: "yoga",
    name: "Yoga",
    title: "Room to move",
    description: "Explore a beginner-friendly studio session.",
    guide: "guide-yoga-mat",
    accent: "#f4edec",
    kit: "Ask the studio whether it lends mats; wear clothing you can move in.",
    search: "beginner yoga trial class studio",
    checks: [
      "Confirm that the class welcomes beginners",
      "Ask whether a mat is provided",
      "Confirm the fee and cancellation terms with the studio",
    ],
  },
  {
    id: "trekking",
    name: "Day walking",
    title: "Take the scenic way",
    description: "Plan an easy, familiar outdoor walk.",
    guide: "guide-backpack-litres",
    accent: "#efefdf",
    kit: "Use a suitable bag you own; check route-specific requirements separately.",
    search: "beginner walking group park",
    checks: [
      "Check the route, access and local conditions",
      "Arrange water, suitable footwear and sun or rain protection",
      "Share your route and return time with someone",
    ],
  },
] as const;
export const sportFor = (goal: Goal) => SPORTS.find((s) => s.id === goal)!;
export const isGoal = (v: unknown): v is Goal =>
  typeof v === "string" && Object.hasOwn(GOALS, v);
export type FitValue = "snug" | "right" | "loose";
export type FitRecord = {
  id: string;
  productId: string;
  size: string;
  overall: FitValue;
  comfort: "restricted" | "comfortable";
  areas: string[];
  note: string;
  updatedAt: string;
};
export type Adventure = {
  id: string;
  goal: Goal;
  budget: number;
  date: string;
  owned: string[];
  checked: string[];
  updatedAt: string;
};
export type Trial = {
  id: string;
  goal: Goal;
  mode: "friend" | "class";
  city: string;
  date: string;
  time: string;
  minutes: 30 | 45 | 60;
  checked: string[];
  status: "planned" | "tried";
  enjoyment: number;
  reflection: string;
  updatedAt: string;
};
export type ExperienceState = {
  version: 1;
  fits: FitRecord[];
  adventures: Adventure[];
  trials: Trial[];
};
export const EMPTY_EXPERIENCES: ExperienceState = {
  version: 1,
  fits: [],
  adventures: [],
  trials: [],
};
export const fitEligible = (id: string) => {
  const p = getProduct(id);
  return (
    !!p &&
    p.sizes.length > 1 &&
    /shoes|pants|shorts|tops|shirts|apparel|socks/i.test(p.category)
  );
};
export const FIT_PRODUCTS = products.filter((p) => fitEligible(p.id));
export function validDate(v: unknown): v is string {
  if (typeof v !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const d = new Date(`${v}T12:00:00Z`);
  return Number.isFinite(d.getTime()) && d.toISOString().slice(0, 10) === v;
}
export const localDate = (date = new Date()) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
export const validTime = (v: unknown): v is string =>
  typeof v === "string" && /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(v);
const strings = (v: unknown, max = 30): string[] =>
  Array.isArray(v)
    ? [
        ...new Set(
          v.filter(
            (x): x is string => typeof x === "string" && x.length <= 160,
          ),
        ),
      ].slice(0, max)
    : [];
const text = (v: unknown, max: number) =>
  typeof v === "string" ? v.trim().slice(0, max) : "";
const values = (v: unknown): Record<string, unknown> | null =>
  v && typeof v === "object" && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : null;
const stamp = (v: unknown) =>
  typeof v === "string" && Number.isFinite(Date.parse(v))
    ? v
    : new Date(0).toISOString();
const recordId = (v: unknown) =>
  typeof v === "string" && /^[\w-]{1,80}$/.test(v) ? v : "";
export function parseExperiences(input: unknown): ExperienceState {
  const data = values(input);
  if (!data || data.version !== 1)
    throw new Error("Saved experiences have an unsupported format.");
  const fits: FitRecord[] = [],
    adventures: Adventure[] = [],
    trials: Trial[] = [];
  for (const raw of Array.isArray(data.fits) ? data.fits.slice(0, 50) : []) {
    const r = values(raw);
    if (
      !r ||
      !recordId(r.id) ||
      typeof r.productId !== "string" ||
      !fitEligible(r.productId) ||
      !getProduct(r.productId)!.sizes.includes(String(r.size)) ||
      !["snug", "right", "loose"].includes(String(r.overall)) ||
      !["restricted", "comfortable"].includes(String(r.comfort))
    )
      continue;
    if (fits.some((f) => f.id === r.id)) continue;
    fits.push({
      id: recordId(r.id),
      productId: r.productId,
      size: String(r.size),
      overall: r.overall as FitValue,
      comfort: r.comfort as FitRecord["comfort"],
      areas: strings(r.areas, 5).filter((a) =>
        ["Shoulders", "Chest", "Waist", "Length", "Feet"].includes(a),
      ),
      note: text(r.note, 200),
      updatedAt: stamp(r.updatedAt),
    });
  }
  for (const raw of Array.isArray(data.adventures)
    ? data.adventures.slice(0, 12)
    : []) {
    const r = values(raw);
    if (
      !r ||
      !recordId(r.id) ||
      !isGoal(r.goal) ||
      typeof r.budget !== "number" ||
      !Number.isFinite(r.budget) ||
      r.budget < 500 ||
      r.budget > 100000 ||
      (r.date !== "" && !validDate(r.date))
    )
      continue;
    if (adventures.some((a) => a.id === r.id)) continue;
    adventures.push({
      id: recordId(r.id),
      goal: r.goal,
      budget: r.budget,
      date: r.date as string,
      owned: strings(r.owned).filter((id) =>
        GOALS[r.goal as Goal].needs.some((n) => n.id === id),
      ),
      checked: strings(r.checked),
      updatedAt: stamp(r.updatedAt),
    });
  }
  for (const raw of Array.isArray(data.trials)
    ? data.trials.slice(0, 12)
    : []) {
    const r = values(raw);
    if (
      !r ||
      !recordId(r.id) ||
      !isGoal(r.goal) ||
      !["friend", "class"].includes(String(r.mode)) ||
      !validDate(r.date) ||
      !validTime(r.time) ||
      ![30, 45, 60].includes(Number(r.minutes)) ||
      !["planned", "tried"].includes(String(r.status))
    )
      continue;
    if (trials.some((t) => t.id === r.id)) continue;
    trials.push({
      id: recordId(r.id),
      goal: r.goal,
      mode: r.mode as Trial["mode"],
      city: text(r.city, 80),
      date: r.date,
      time: r.time,
      minutes: Number(r.minutes) as Trial["minutes"],
      checked: strings(r.checked),
      status: r.status as Trial["status"],
      enjoyment: Math.max(0, Math.min(5, Math.round(Number(r.enjoyment) || 0))),
      reflection: text(r.reflection, 300),
      updatedAt: stamp(r.updatedAt),
    });
  }
  return { version: 1, fits, adventures, trials };
}
export function fitInsight(productId: string, records: FitRecord[]) {
  const exact = records
    .filter((r) => r.productId === productId)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const good = exact.find(
    (r) => r.overall === "right" && r.comfort === "comfortable",
  );
  if (good)
    return {
      size: good.size,
      message: `You recorded size ${good.size} as a comfortable fit for this exact item.`,
      record: good,
    };
  if (exact[0])
    return {
      size: null,
      message: `Last time, size ${exact[0].size} felt ${exact[0].overall === "right" ? "right overall" : `too ${exact[0].overall}`} ${exact[0].comfort === "restricted" ? "but restricted movement" : ""}. Check the size guide before choosing.`,
      record: exact[0],
    };
  return {
    size: null,
    message:
      "No fit memory for this item yet. Sizes can differ between products.",
    record: null,
  };
}
export function adventurePlan(a: Pick<Adventure, "goal" | "budget" | "owned">) {
  return buildPlan({
    goal: a.goal,
    budget: a.budget,
    owned: a.owned,
    weeks: 4,
  });
}
export function venueSearch(goal: Goal, city: string) {
  const query = `${sportFor(goal).search} ${city.trim().slice(0, 80)}`.trim();
  return `https://www.google.com/maps/search/?${new URLSearchParams({ api: "1", query })}`;
}
export function trialAgenda(minutes: number) {
  return [
    { title: "Arrive and get comfortable", minutes: 10 },
    { title: "Explore at your own pace", minutes: minutes - 20 },
    { title: "Pause and reflect", minutes: 10 },
  ];
}
const escapeICS = (s: string) =>
  s
    .replace(/\\/g, "\\\\")
    .replace(/\r\n|\r|\n/g, "\\n")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,");
function fold(line: string) {
  const rows: string[] = [];
  let row = "";
  for (const char of line) {
    if (new TextEncoder().encode(row + char).length > 74) {
      rows.push(row);
      row = " " + char;
    } else row += char;
  }
  rows.push(row);
  return rows.join("\r\n");
}
export function trialCalendar(t: Trial, now = new Date()) {
  if (!validDate(t.date) || !validTime(t.time))
    throw new Error("Choose a valid date and time first.");
  const start = new Date(`${t.date}T${t.time}:00`);
  if (!Number.isFinite(start.getTime()))
    throw new Error("Invalid session time.");
  const end = new Date(start.getTime() + t.minutes * 60_000);
  const floating = (d: Date) =>
    `${localDate(d).replace(/-/g, "")}T${String(d.getHours()).padStart(2, "0")}${String(d.getMinutes()).padStart(2, "0")}00`;
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Sports companion//Trial planner//EN",
    "BEGIN:VEVENT",
    `UID:${recordId(t.id)}@sports-companion.local`,
    `DTSTAMP:${now
      .toISOString()
      .replace(/[-:]/g, "")
      .replace(/\.\d{3}Z$/, "Z")}`,
    `DTSTART:${floating(start)}`,
    `DTEND:${floating(end)}`,
    `SUMMARY:${escapeICS(`Try ${sportFor(t.goal).name.toLowerCase()} — personal plan`)}`,
    `LOCATION:${escapeICS(t.city)}`,
    `DESCRIPTION:${escapeICS("Personal reminder only. No venue booking or equipment reservation has been made. Confirm venue, availability, fees and equipment separately.")}`,
    "STATUS:TENTATIVE",
    "END:VEVENT",
    "END:VCALENDAR",
    "",
  ]
    .map(fold)
    .join("\r\n");
}
