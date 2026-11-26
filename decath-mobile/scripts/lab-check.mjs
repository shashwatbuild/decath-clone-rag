import { createJiti } from "jiti";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
const root = fileURLToPath(new URL("..", import.meta.url));
const jiti = createJiti(import.meta.url, { alias: { "@": root } });
const { DEFAULT_LAB } = await jiti.import("@/lib/lab/types.ts");
const { parseLabInput } = await jiti.import("@/lib/lab/input.ts");
const { analyzeLab, teamPlan } = await jiti.import("@/lib/lab/engine.ts");
const C = await jiti.import("@/lib/lab/community.ts");
const G = await jiti.import("@/lib/tryon/geometry.ts");
const { products } = await jiti.import("@/lib/products.ts");
const { KNOWLEDGE } = await jiti.import("@/lib/rag/knowledge.ts");
const state = patch => parseLabInput({ ...structuredClone(DEFAULT_LAB), ...patch });
let checks = 0;
function check(label, fn) { fn(); checks++; console.log(`PASS ${label}`); }
for (const goal of ["running", "badminton", "yoga", "trekking"]) {
  const input = state({ goal, query: `how to choose ${goal} gear`, answers: {} });
  const r = analyzeLab(input);
  check(`${goal}: all eight features return coherent data`, () => { assert(r.candidates.length); assert(r.sources.length); assert(r.future.current.length); assert(r.rehearsal.length); assert(r.advocate.length); assert(r.team.lines.length); });
  check(`${goal}: all eligible contracts enforce budget, stock and required evidence`, () => { for (const c of r.candidates.filter(c => c.eligible)) { assert(c.product.price <= input.budget); assert(c.product.inStock); assert(c.checks.filter(c => c.must).every(c => c.status === "match")); } });
  check(`${goal}: real sources and diversified multi-query retrieval`, () => { assert(r.retrieval.queries.length >= 2); assert(r.sources.some(s => s.kind === "guide")); assert(r.sources.every(s => s.text && s.url.startsWith("/") && s.n > 0)); assert.equal(new Set(r.sources.map(s => s.id)).size, r.sources.length); });
  check(`${goal}: scenario never spends beyond budget`, () => { assert(r.future.currentCost <= input.budget); assert(r.future.nextCost <= input.budget); });
}
check("running conditions and gear memory never cite unrelated sports guides", () => {
  const r = analyzeLab(state({ rain: true, longSession: true }));
  for (const source of r.sources) { const k = KNOWLEDGE.find(k => source.url === `/guides/${k.id}`); if (k) assert.equal(k.topic, "running"); }
});
check("zero budget yields uncovered needs instead of silently overspending", () => {
  const r = analyzeLab(state({ budget: 0, members: [{ id: "me", name: "Me", budget: 0, ownedIds: [] }] }));
  assert(r.candidates.every(c => !c.eligible)); assert.equal(r.future.nextCost, 0); assert(r.future.next.some(l => !l.product)); assert(r.team.uncovered > 0); assert(r.team.totals.every(t => t.spent === 0));
});
check("answer changes affect contracts and do not invent an eligible match", () => {
  const a = analyzeLab(state({ goal: "yoga", budget: 1000, answers: { type: "flared" } }));
  const b = analyzeLab(state({ goal: "yoga", budget: 700, answers: { type: "flared" } }));
  assert.notEqual(a.revision, b.revision); assert(a.candidates.some(c => c.eligible)); assert(!b.candidates.some(c => c.eligible));
});
const sock = products.find(p => p.category === "Running Socks");
const gear = { id: "owned-socks", productId: sock.id, condition: "good", size: "", logs: [{ id: "log1", date: "2026-11-20", kind: "use", minutes: 40, note: "Comfortable" }] };
check("usable owned gear reduces purchases and drives reuse advice", () => {
  const r = analyzeLab(state({ gear: [gear] })); assert(r.future.current.find(l => l.category === sock.category).owned); assert.equal(r.lifecycle[0].minutes, 40); assert.equal(r.lifecycle[0].uses, 1); assert.equal(r.advocate.find(l => l.category === sock.category).action, "reuse");
});
check("repair items are excluded from reuse and do not get remaining-life predictions", () => {
  const r = analyzeLab(state({ gear: [{ ...gear, condition: "repair" }] })); assert(!r.future.current.find(l => l.category === sock.category).owned); assert.equal(r.advocate.find(l => l.category === sock.category).action, "maintain"); assert.match(r.lifecycle[0].advice, /No remaining-life estimate/);
});
check("next experiment actually separates current products", () => {
  const r = analyzeLab(state({ goal: "yoga", budget: 5000 })); assert(r.experiment); assert(r.experiment.options.some(o => o.count > 0 && o.count < r.experiment.before));
});
check("team shares shuttles once, never personal shoes or rackets", () => {
  const r = teamPlan(state({ goal: "badminton", members: [{ id: "a", name: "A", budget: 5000, ownedIds: [] }, { id: "b", name: "B", budget: 5000, ownedIds: [] }] }));
  assert.equal(r.lines.filter(l => l.category === "Shuttlecocks").length, 1); assert.equal(r.lines.filter(l => l.category === "Badminton Rackets").length, 2); assert(r.savedBySharing > 0); assert(r.totals.every(t => t.remaining >= 0 && t.spent <= 5000));
});
for (const patch of [{ budget: -1 }, { budget: NaN }, { goal: "swimming" }, { answers: { fabricated: "yes" } }, { gear: [{ ...gear, productId: "missing" }] }, { gear: [{ ...gear, logs: [{ ...gear.logs[0], date: "2026-02-31" }] }] }]) {
  check(`invalid state rejected: ${Object.keys(patch)[0]}`, () => assert.throws(() => state(patch)));
}
check("clothing support is category-specific", () => { assert.equal(G.garmentKind({ category: "T-Shirts", name: "Blue shirt" }), "top"); assert.equal(G.garmentKind({ category: "Running Shorts", name: "Shorts" }), "shorts"); assert.equal(G.garmentKind({ category: "Badminton Rackets", name: "BR100" }), null); });
check("pose placement refuses missing/low-confidence joints and accepts a valid torso", () => {
  assert.equal(G.placement([], "top", 600, 800), null);
  const p = Array.from({ length: 33 }, () => ({ x: .5, y: .5, visibility: 1 }));
  p[11] = { x: .3, y: .2 }; p[12] = { x: .7, y: .2 }; p[23] = { x: .4, y: .6 }; p[24] = { x: .6, y: .6 };
  const box = G.placement(p, "top", 600, 800); assert(box && box.width > 0 && box.height > 0); p[11].visibility = .1; assert.equal(G.placement(p, "top", 600, 800), null);
});
check("upper-body camera anchors shirts to shoulders and labels estimated length", () => {
  const points = Array.from({ length: 33 }, () => ({ x: .5, y: .5, visibility: .1 }));
  points[11] = { x: .3, y: .25, visibility: .9 }; points[12] = { x: .7, y: .25, visibility: .9 };
  const first = G.placement(points, "top", 600, 800); assert(first?.estimated);
  points[11].x += .1; points[12].x += .1;
  assert(G.placement(points, "top", 600, 800).x > first.x);
  assert.equal(G.placement(points, "shorts", 600, 800), null);
});
check("community refuses sharing without consent", () => assert.throws(() => C.validateContribution({ token: randomUUID(), productId: sock.id, size: sock.sizes[0], fit: "right", consent: false })));
const token = randomUUID();
const vote = C.validateContribution({ token, productId: sock.id, size: sock.sizes[0], fit: "right", consent: true });
check("community hashes the token and suppresses small/duplicate groups", () => { assert.notEqual(vote.contributor, token); assert.deepEqual(C.aggregateCommunity(Array(7).fill(vote)), []); });
const votes = Array.from({ length: 5 }, () => C.validateContribution({ token: randomUUID(), productId: sock.id, size: sock.sizes[0], fit: "right", consent: true }));
check("five distinct contributions produce aggregate counts only", () => { const [g] = C.aggregateCommunity(votes); assert.equal(g.participants, 5); assert.equal(g.right, 5); assert(!("contributor" in g)); });
const temporary = await mkdtemp(path.join(os.tmpdir(), "gear-lab-test-")); process.env.LAB_DATA_DIR = temporary;
try {
  check("empty persistent community starts with no fabricated reports", () => {});
  assert.deepEqual((await C.readCommunity()).groups, []);
  await Promise.all(Array.from({ length: 5 }, (_, i) => C.contribute({ token: i ? randomUUID() : token, productId: sock.id, size: sock.sizes[0], fit: "right", consent: true })));
  assert.equal((await C.readCommunity()).groups[0].participants, 5);
  await C.forgetContributions(token); assert.equal((await C.readCommunity()).groups.length, 0);
  console.log("PASS concurrent atomic writes and device-token deletion"); checks++;
} finally { await rm(temporary, { recursive: true, force: true }); delete process.env.LAB_DATA_DIR; }
console.log(`\n${checks} checks passed`);
