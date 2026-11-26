import type { Goal } from "../plan";
import type { ProductLite, Source } from "../types";
import type { Brief, Check } from "../advisor/engine";

export type GearCondition = "good" | "worn" | "repair";
export type GearLog = { id: string; date: string; kind: "use" | "repair" | "comfort"; note: string; minutes: number };
export type OwnedGear = { id: string; productId: string; condition: GearCondition; size: string; logs: GearLog[] };
export type Member = { id: string; name: string; budget: number; ownedIds: string[] };
export type LabInput = {
  goal: Goal; budget: number; query: string; level: string; priority: "match" | "price" | "weight";
  stage: "start" | "progress" | "challenge"; weeks: number;
  rain: boolean; outdoor: boolean; longSession: boolean;
  answers: Record<string, string>; footCm: number | null;
  gear: OwnedGear[]; members: Member[];
};
export const DEFAULT_LAB: LabInput = {
  goal: "running", budget: 8000, query: "Comfortable gear for regular running", level: "beginner", priority: "match",
  stage: "progress", weeks: 8, rain: false, outdoor: true, longSession: false, answers: {}, footCm: null, gear: [],
  members: [{ id: "me", name: "You", budget: 4000, ownedIds: [] }, { id: "partner", name: "Teammate", budget: 4000, ownedIds: [] }],
};
export type LabProduct = ProductLite & { sizes: string[]; inStock: boolean; weightKg: number | null };
export type Contract = { product: LabProduct; eligible: boolean; checks: Check[]; fingerprint: string; unknowns: string[] };
export type LabPassage = Source & { text: string; queries: number; score: number };
export type Experiment = { id: string; label: string; why: string; options: { id: string; label: string; count: number }[]; before: number; unknown: number; expectedReduction: number };
export type ScenarioLine = { category: string; label: string; product: LabProduct | null; owned: boolean; reason: string };
export type TeamLine = { memberId: string; category: string; product: LabProduct | null; owned: boolean; shared: boolean; reason: string };
export type LabResult = {
  revision: string; brief: Brief; candidates: Contract[]; sources: LabPassage[];
  retrieval: { queries: string[]; stages: string[]; sufficient: boolean; memory: string[] };
  answer: string; experiment: Experiment | null;
  future: { current: ScenarioLine[]; next: ScenarioLine[]; currentCost: number; nextCost: number; delta: number; assumptions: string[] };
  rehearsal: { title: string; status: "check" | "unknown" | "ready"; detail: string; sourceIds: string[] }[];
  lifecycle: { gearId: string; name: string; minutes: number; uses: number; advice: string; sources: Source[] }[];
  team: { lines: TeamLine[]; totals: { memberId: string; spent: number; remaining: number }[]; uncovered: number; savedBySharing: number };
  advocate: { category: string; action: "reuse" | "maintain" | "inspect" | "consider" | "defer"; detail: string; product: LabProduct | null }[];
};
