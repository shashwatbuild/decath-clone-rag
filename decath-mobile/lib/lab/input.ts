import { products } from "../products";
import { PROFILES, type ProfileId } from "../advisor/profiles";
import { DEFAULT_LAB, type LabInput, type GearLog, type OwnedGear, type Member } from "./types";

export class LabInputError extends Error {}
const record = (v: unknown): Record<string, unknown> => {
  if (!v || typeof v !== "object" || Array.isArray(v)) throw new LabInputError("Expected an object.");
  return v as Record<string, unknown>;
};
const str = (v: unknown, max = 300): string => {
  if (typeof v !== "string" || v.length > max) throw new LabInputError(`Text must be at most ${max} characters.`);
  return v.trim();
};
const num = (v: unknown, min: number, max: number): number => {
  if (typeof v !== "number" || !Number.isFinite(v) || v < min || v > max) throw new LabInputError(`Number must be between ${min} and ${max}.`);
  return v;
};
function choice<T extends string>(v: unknown, choices: readonly T[]): T {
  if (!choices.includes(v as T)) throw new LabInputError("Unknown option.");
  return v as T;
}
function list(v: unknown, max: number): unknown[] {
  if (!Array.isArray(v) || v.length > max) throw new LabInputError(`List must contain at most ${max} items.`);
  return v;
}
const validProduct = (v: unknown) => {
  const id = str(v, 40);
  if (!products.some(p => p.id === id)) throw new LabInputError("Product is not in the catalogue.");
  return id;
};
export const PROFILE: Record<LabInput["goal"], ProfileId> = { running: "running-shoes", yoga: "yoga-pants", trekking: "backpacks", badminton: "badminton-rackets" };

export function parseLabInput(value: unknown): LabInput {
  const x = record(value);
  const goal = choice(x.goal ?? DEFAULT_LAB.goal, ["running", "badminton", "yoga", "trekking"] as const);
  const answers: Record<string, string> = {};
  for (const [key, value] of Object.entries(record(x.answers ?? {}))) {
    const criterion = PROFILES[PROFILE[goal]].criteria.find(c => c.id === key);
    if (!criterion || !criterion.options.some(o => o.id === value)) throw new LabInputError("An experiment answer is not valid for this activity.");
    answers[key] = value as string;
  }
  const gear: OwnedGear[] = list(x.gear ?? [], 40).map(v => {
    const g = record(v); const productId = validProduct(g.productId);
    const logs: GearLog[] = list(g.logs ?? [], 100).map(v => {
      const l = record(v); const date = str(l.date, 30);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Date.parse(date)) || new Date(date).toISOString().slice(0, 10) !== date) throw new LabInputError("Use a valid log date.");
      return { id: str(l.id, 80), date, kind: choice(l.kind, ["use", "repair", "comfort"] as const), note: str(l.note ?? "", 300), minutes: num(l.minutes ?? 0, 0, 1440) };
    });
    const size = str(g.size ?? "", 60);
    if (size && !products.find(p => p.id === productId)!.sizes.includes(size)) throw new LabInputError("Owned size must be a listed option.");
    return { id: str(g.id, 80), productId, condition: choice(g.condition, ["good", "worn", "repair"] as const), size, logs };
  });
  if (new Set(gear.map(g => g.id)).size !== gear.length || new Set(gear.map(g => g.productId)).size !== gear.length) throw new LabInputError("Each owned product must be unique.");
  const members: Member[] = list(x.members ?? DEFAULT_LAB.members, 6).map(v => {
    const m = record(v); const id = str(m.id, 50); const name = str(m.name, 40);
    if (!id || !name) throw new LabInputError("Each teammate needs a name and ID.");
    return { id, name, budget: num(m.budget, 0, 1000000), ownedIds: [...new Set(list(m.ownedIds ?? [], 40).map(validProduct))] };
  });
  if (!members.length || new Set(members.map(m => m.id)).size !== members.length) throw new LabInputError("Use one to six unique teammates.");
  const bool = (v: unknown, fallback: boolean) => { if (v === undefined) return fallback; if (typeof v !== "boolean") throw new LabInputError("Expected a yes/no choice."); return v; };
  return {
    goal, budget: num(x.budget ?? DEFAULT_LAB.budget, 0, 1000000), query: str(x.query ?? DEFAULT_LAB.query, 500),
    level: choice(x.level ?? "beginner", ["beginner", "intermediate", "advanced"]), priority: choice(x.priority ?? "match", ["match", "price", "weight"]),
    stage: choice(x.stage ?? "progress", ["start", "progress", "challenge"]), weeks: Math.round(num(x.weeks ?? 8, 1, 52)),
    rain: bool(x.rain, false), outdoor: bool(x.outdoor, true), longSession: bool(x.longSession, false),
    answers, footCm: x.footCm == null ? null : num(x.footCm, 18, 34), gear, members,
  };
}
