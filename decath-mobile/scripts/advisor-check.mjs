// Run: node scripts/advisor-check.mjs  — the advisor's demo journey and edge cases against the real catalogue.
import { createJiti } from "jiti";
import { fileURLToPath } from "node:url";
const root = fileURLToPath(new URL("..", import.meta.url));
const jiti = createJiti(import.meta.url, { alias: { "@": root } });
const S = await jiti.import("@/lib/advisor/session.ts");
const E = await jiti.import("@/lib/advisor/engine.ts");
const X = await jiti.import("@/lib/advisor/explain.ts");
const K = await jiti.import("@/lib/advisor/kit.ts");
const { products } = await jiti.import("@/lib/products.ts");
let fails = 0;
const ok = (c, m) => { console.log(`${c ? "PASS" : "FAIL"}  ${m}`); if (!c) fails++; };
const res = (s) => { const r = E.evaluateBrief(s.brief, s.selected); return { r, rec: X.recommend(r, s.brief) }; };
const top = (r) => (r.verdict.top ?? r.verdict.group?.[0])?.p.shortName;

ok(products.filter((p) => p.category === "Yoga Pants").length >= 10, "catalogue has at least 10 yoga pants");

// 1–2. need → pant-type cards first (not length); activity, level, budget not asked again
const st = S.detectStart("I'm starting yoga and want pants under ₹1,000");
ok(st.brief.budget === 1000 && st.brief.values.level === "beginner", "budget + level extracted");
let s = S.begin(st.brief, st.selected, st.count, 1);
ok(s.queue[0] === "type" && S.questionMessage(s).cards === "type", `starts with pant-type cards (queue=${s.queue})`);
ok(!s.queue.includes("length") && !s.queue.includes("level"), "length and level are not asked");
const cards = S.cardsFor(s.brief, "type");
ok(cards.length >= 4 && cards.every((c) => c.image && c.count), `type cards from catalogue: ${cards.map((c) => `${c.label} (${c.count})`).join(", ")}`);
// 3–4. flared, then skip refinement
s = S.answer(s, "Flared yoga pants");
ok(JSON.stringify(s.brief.values.type) === '["flared"]', "flared selected");
ok(s.queue.length <= 2, `at most two more questions (${s.queue})`);
s = S.answer(s, "Skip");
ok(!s.queue.includes("fit"), "skipped question isn't asked again");
s = S.finish(s, 3);
// 5–6. brief + comparison
let { r, rec } = res(s);
ok(/Trackpants/.test(top(r)) && /flared style/.test(rec.headline) && /₹200 more/.test(rec.headline), `flared trackpants recommended: ${rec.headline}`);
ok(X.labelsFor(r.selected[0], r, s.brief).some((l) => l.text === "Matches your preferred flared style"), "label: Matches your preferred flared style");
ok(X.briefLines(s.brief).every((l) => l.value !== "Not set"), "brief shows only supplied values");
// 7–9. lowest price → capri; must-haves respected; undo
const before = top(r);
s = S.commit(s, { priority: "price" }); ({ r, rec } = res(s));
ok(/Capri/.test(top(r)) && r.eligible.every((e) => e.p.price <= 1000), `lowest price: ${s.change.effect}`);
s = S.undo(s); ({ r } = res(s));
ok(top(r) === before && s.brief.priority === "match", "undo restores the trackpants");
// flared as a must-have: capri clearly fails it
let s2 = S.commit(s, { must: { type: true } }); ({ r } = res(s2));
const capri = r.selected.find((e) => /Capri/.test(e.p.shortName));
ok(capri && !capri.eligible && capri.blockers.some((b) => b.id === "type"), "required flared: capri marked as not meeting it");
// 10–13. kit
s = S.openKit(s);
ok(s.kit.items.pants.pick === "9030986" && s.kit.items.pants.carried, "selected pants carried into the kit");
ok(Object.values(s.kit.items).every((i) => i.state === null), "no item assumed needed");
s = S.commitKit(s, { mat: { state: "own" }, pants: { state: "need" }, strap: { state: "skip" } });
let sum = K.summarise(s.brief, s.kit, []);
ok(sum.total === 999 && sum.selected.length === 1 && sum.covered.length === 1, `owned mat + skipped strap excluded: total ₹${sum.total}, covered ${sum.covered.length}, undecided ${sum.undecided}`);
ok(!sum.selected.some((l) => l.def.id === "mat" || l.def.id === "strap"), "owned / skipped never in purchases");
// 14. separate kit budget
s = S.commitKit(s, {}, 800); sum = K.summarise(s.brief, s.kit, []);
ok(s.brief.budget === 1000 && sum.over === 199, `kit budget separate from pants budget; over by ₹${sum.over}`);
const swaps = K.cheaperSwaps(s.brief, sum);
ok(swaps.length && swaps[0].to.price <= 1000, `cheaper eligible swap offered: ${swaps.map((w) => w.to.shortName)}`);
s = S.commitKit(s, {}, 2500);
// 15. sizes before cart; cart dedupe
sum = K.summarise(s.brief, s.kit, []);
ok(sum.readyToAdd.length === 0 && sum.missingSizes.length === 1, "size required before adding");
s = S.commitKit(s, { pants: { size: "M" } }); sum = K.summarise(s.brief, s.kit, []);
ok(sum.readyToAdd.length === 1, "ready to add after size chosen");
sum = K.summarise(s.brief, s.kit, [{ id: "9030986", size: "M", qty: 1 }]);
ok(sum.readyToAdd.length === 0 && sum.selected[0].inCart, "item already in cart isn't added twice");
// all owned
const own = S.commitKit(s, { pants: { state: "own" }, mat: { state: "own" }, blocks: { state: "skip" }, strap: { state: "skip" } });
ok(K.summarise(own.brief, own.kit, []).allOwned && /No new purchases needed/.test(own.change.effect), "all owned: no new purchases needed");
// undo restores kit
const u = S.undo(own); ok(u.kit.items.pants.state === "need", "undo restores the kit");
// help me choose
let h = S.begin(st.brief, null, 2, 1); h = S.answer(h, "Help me choose");
ok(h.queue.join() === "fit,practice" && h.brief.values.type === undefined, "help me choose asks fit + practice, doesn't pick a type");
h = S.answer(S.answer(h, "Relaxed"), "Gentle");
ok(/kept all types open/.test(S.helpSummary(h.brief)), "help summary explains types");
// missing data / feel only from benefits
s2 = S.commit(s, { values: { feel: "soft" } }); ({ r } = res(s2));
ok(r.ranked.every((e) => e.checks.find((c) => c.id === "feel").status !== "mismatch"), "feel never counts as a mismatch when not listed");
// conflicts
s2 = S.commit(s, { budget: 700, must: { type: true } }); ({ r } = res(s2));
ok(r.verdict.kind === "none" && r.verdict.conflict.fixes.length >= 2, `${r.verdict.conflict?.text} → ${r.verdict.conflict?.fixes.map((f) => f.label)}`);
// chat parsing
ok(S.parseKit("I already have a mat", s).items.mat.state === "own" && S.parseKit("kit budget 2500", s).budget === 2500, "kit changes from chat");
const pu = S.parseUpdate("I want high-waisted leggings with pockets, pockets are a must", s.brief);
ok(pu.values.waist === "high" && pu.values.type?.includes("leggings") && pu.must.pockets, `typed preferences: ${JSON.stringify(pu)}`);
// other sports keep their own controls
const bp = S.detectStart("Lightest trekking backpack for a 5 day trek");
ok(bp.brief.profile === "backpacks" && bp.brief.values.capacity === "60" && !E.profileOf(bp.brief).controls.some((c) => c.id === "type"), "backpacks: own criteria, no yoga controls");
for (const q of ["show yoga pants", "Is the capri good for beginners?", "Running shoes for a marathon"]) ok(S.detectStart(q) === null, `"${q}" → existing flow`);
console.log(fails ? `\n${fails} FAILED` : "\nall passed"); process.exit(fails ? 1 : 0);
