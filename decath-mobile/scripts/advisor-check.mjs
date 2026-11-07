// Run: node scripts/advisor-check.mjs  — exercises the demo journey and edge cases against the real catalogue.
import { createJiti } from "jiti";
import { fileURLToPath } from "node:url";
const root = fileURLToPath(new URL("..", import.meta.url));
const jiti = createJiti(import.meta.url, { alias: { "@": root } });
const S = await jiti.import("@/lib/advisor/session.ts");
const E = await jiti.import("@/lib/advisor/engine.ts");
const X = await jiti.import("@/lib/advisor/explain.ts");
let fails = 0;
const ok = (c, m) => { console.log(`${c ? "PASS" : "FAIL"}  ${m}`); if (!c) fails++; };
const show = (s) => { const r = E.evaluateBrief(s.brief, s.selected); const rec = X.recommend(r, s.brief); return { r, rec }; };

// 1. beginner yoga pants under 1000
const st = S.detectStart("I'm starting yoga and want pants under ₹1,000");
ok(st?.kind === "start" && st.brief.profile === "yoga-pants", "starts yoga-pants flow");
ok(st.brief.budget === 1000 && st.brief.values.level === "beginner", "budget + level extracted");
let s = S.begin(st.brief, st.selected, st.count, 1);
ok(s.queue.join() === "coverage", `asks only coverage (queue=${s.queue})`);
console.log("   Q:", S.questionMessage(s, S.acknowledge(s.brief)).text.replace(/\n/g, " | "));
// 3. full length
s = S.answer(s, "Full length"); s = S.finish(s, 3);
let { r, rec } = show(s);
ok(s.selected.length === 2, `compares ${s.selected.map((id) => E.evaluateBrief(s.brief, [id]).selected[0].p.shortName)}`);
ok(r.verdict.kind === "pick" && /Trackpants/.test(r.verdict.top.p.shortName), "trackpants recommended");
console.log("   ", rec.headline); console.log("    why:", rec.why); console.log("    give up:", rec.giveUp); console.log("    check:", rec.check);
// 7. priority lowest price
s = S.commit(s, { priority: "price" });
({ r, rec } = show(s));
ok(r.verdict.kind === "pick" && /Capri/.test(r.verdict.top.p.shortName), "capri first on lowest price");
console.log("   change:", s.change.lines, "|", s.change.effect); console.log("   ", rec.headline);
ok(s.brief.values.coverage === "full", "coverage stays a preference");
// 9. undo
s = S.undo(s); ({ r } = show(s));
ok(/Trackpants/.test(r.verdict.top.p.shortName) && s.brief.priority === "match", "undo restores trackpants");
console.log("   undo:", s.change.effect);
// budget unchanged
let s2 = S.commit(s, { budget: 1200 });
console.log("   budget 1200:", s2.change.effect); ok(/remain within/.test(s2.change.effect), "budget change explains no effect");
// budget 800 → trackpants ineligible but preserved
s2 = S.commit(s, { budget: 800 }); ({ r, rec } = show(s2));
ok(s2.selected.length === 2 && r.selected.some((e) => !e.eligible), "ineligible product kept in comparison");
console.log("   budget 800:", s2.change.effect, "|", rec.title);
// coverage must-have under 800 → conflict
s2 = S.commit(s2, { must: { coverage: true } }); ({ r } = show(s2));
ok(r.verdict.kind === "none", "conflict when full length must-have under 800");
console.log("   ", r.verdict.conflict?.text, r.verdict.conflict?.fixes.map((f) => f.label));
// practice type: not listed
s2 = S.commit(s, { values: { practice: "gentle" } });
console.log("   practice:", s2.change.effect); ok(/can't be evaluated/.test(s2.change.effect), "practice type can't be evaluated");
// no preference → tie
s2 = S.commit(s, { values: { coverage: null } }); ({ r, rec } = show(s2));
ok(r.verdict.kind === "tie", "no coverage preference → both suitable"); console.log("   ", s2.change.effect, "|", rec.title, "|", rec.headline);
// typed update
const p = S.parseUpdate("actually make it under 800 and any length is fine", s.brief);
ok(p?.budget === 800 && p.values?.coverage === null, `typed update parsed ${JSON.stringify(p)}`);
const p2 = S.parseUpdate("make it under 800, full length is a must", s.brief);
ok(p2?.budget === 800 && p2.must?.coverage === true, `"is a must" makes coverage a must-have ${JSON.stringify(p2)}`);
const p3 = S.parseUpdate("other lengths are fine", { ...s.brief, must: { coverage: true } });
ok(p3?.must?.coverage === false, `"other lengths are fine" relaxes it ${JSON.stringify(p3)}`);
// other sports
for (const q of ["Lightest trekking backpack for a 5 day trek", "Yoga mat for beginners under ₹1000", "I'm starting yoga", "Compare 2 yoga pants which will be suitable for beginners", "show yoga pants", "Is the capri good for beginners?", "Add Soft Flared Yoga Trackpants to cart", "Running shoes for a marathon"]) {
  const d = S.detectStart(q);
  console.log(`   "${q}" →`, d ? d.kind === "start" ? `${d.brief.profile} ${JSON.stringify(d.brief.values)} budget=${d.brief.budget} prio=${d.brief.priority} q=${S.begin(d.brief, d.selected, d.count, 0).queue}` : d.kind : "existing flow");
}
const bp = S.detectStart("Lightest trekking backpack for a 5 day trek");
let sb = S.finish(S.begin(bp.brief, null, 2, 0), 0); ({ r, rec } = show(sb));
console.log("   backpack:", rec.title, "|", rec.headline);
sb = S.commit(sb, { budget: 2500 }); console.log("   backpack ₹2500:", sb.change.effect);
console.log(fails ? `\n${fails} FAILED` : "\nall passed"); process.exit(fails ? 1 : 0);
