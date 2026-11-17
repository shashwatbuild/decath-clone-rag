// Run: node scripts/rag-eval.mjs  — retrieval quality (hybrid vs plain BM25) and answer grounding on a labelled set.
import { createJiti } from "jiti";
import { fileURLToPath } from "node:url";
const root = fileURLToPath(new URL("..", import.meta.url));
const jiti = createJiti(import.meta.url, { alias: { "@": root } });
const H = await jiti.import("@/lib/rag/hybrid.ts");
const A = await jiti.import("@/lib/rag/answer.ts");
const R = await jiti.import("@/lib/rag/rewrite.ts");

// [query, ids that count as a correct source]
const KNOWLEDGE = [
  ["how to choose a badminton racket", ["guide-badminton-racket"]],
  ["which racquet is good for begginers", ["guide-badminton-racket"]],
  ["what weight badminton racket should I buy", ["guide-badminton-racket"]],
  ["head heavy or even balance racket", ["guide-badminton-racket"]],
  ["feather vs plastic shuttlecock", ["guide-shuttlecocks"]],
  ["which shuttlecocks last longer", ["guide-shuttlecocks"]],
  ["shuttlecok feather or plastc", ["guide-shuttlecocks"]],
  ["why can't I use running shoes for badminton", ["guide-badminton-shoes"]],
  ["do I need special shoes for badminton", ["guide-badminton-shoes"]],
  ["what is drop in running shoes", ["guide-running-shoes"]],
  ["how much cushioning for a marathon", ["guide-running-shoes"]],
  ["what is a pronator", ["guide-running-shoes"]],
  ["what do I need for a marathon", ["guide-marathon-kit"]],
  ["how to prevent blisters while running", ["guide-marathon-kit"]],
  ["do I need a hydration belt", ["guide-marathon-kit"]],
  ["how thick should a yoga mat be", ["guide-yoga-mat"]],
  ["best yoga mat for knee pain", ["guide-yoga-mat"]],
  ["how many litres backpack for 3 day trek", ["guide-backpack-litres"]],
  ["which bag size for a weekend hike", ["guide-backpack-litres"]],
  ["how to measure my foot for shoes", ["guide-shoe-size"]],
  ["what bicycle frame size for 170 cm", ["guide-cycle-size"]],
  ["which football size for a 10 year old", ["guide-football-size"]],
  ["what is the return policy", ["policy-returns"]],
  ["can I exchange a product", ["policy-returns"]],
  ["how long does delivery take", ["policy-delivery"]],
  ["is shipping free", ["policy-delivery"]],
  ["any coupon codes", ["policy-coupons"]],
  ["how do I pay", ["policy-payment"]],
  ["can the chatbot pay for me", ["policy-payment"]],
  ["how do I find my size", ["policy-size-finder"]],
  ["how do I get alerts when a price drops", ["policy-price-watch"]],
  ["what is the kit builder", ["policy-kits"]],
];
// Written after tuning and never used to tune: the honest number.
const HELDOUT = [
  ["what should I look for in shuttlecocks for outdoor play", ["guide-shuttlecocks"]],
  ["is a 6mm mat good for a beginner", ["guide-yoga-mat"]],
  ["should I buy feather or nylon shuttles", ["guide-shuttlecocks"]],
  ["difference between g4 and g5 grip size", ["guide-badminton-racket"]],
  ["when should I replace my running shoes", ["guide-running-shoes"]],
  ["what size football for adults", ["guide-football-size"]],
  ["does the store offer pickup", ["policy-delivery"]],
  ["how do I use a coupon", ["policy-coupons"]],
  ["can I return a product after two weeks", ["policy-returns"]],
  ["what is a stability shoe", ["guide-running-shoes"]],
  ["how to pick a bike size for my height", ["guide-cycle-size"]],
  ["are cotton socks ok for long runs", ["guide-marathon-kit"]],
];
const PRODUCTS = [
  ["BR 100 racket", ["8515767"]],
  ["kiprun kipride max", ["8960547"]],
  ["8mm gentle yoga mat", ["8665059"]],
  ["mt900 ultra light backpack", ["8843416"]],
  ["seamless running shorts", ["8588345"]],
  ["compression running socks", ["8939333"]],
  ["coros gps watch", ["1000001029", "1000005737"]],
  ["badminton wave overgrip", ["8811889", "8811891", "8811890", "8811896"]],
  ["feather shuttlecock speed 76 pack of 12", ["8490802", "8490815", "8373140", "8491565"]],
  ["racqet for begginers", ["8515767", "8851501", "8579601"]],
];
const OUT_OF_SCOPE = ["who won the world cup", "bitcoin price today", "best pizza recipe", "capital of france", "tell me a joke", "weather in mumbai tomorrow"];

let fails = 0;
const ok = (c, m) => { console.log(`${c ? "PASS" : "FAIL"}  ${m}`); if (!c) fails++; };

function evaluate(name, cases, run) {
  let r1 = 0, r3 = 0, r5 = 0, mrr = 0;
  const misses = [];
  for (const [q, want] of cases) {
    const refs = run(q).map((h) => h.doc.ref);
    const at = refs.findIndex((r) => want.includes(r));
    if (at === 0) r1++;
    if (at >= 0 && at < 3) r3++;
    if (at >= 0 && at < 5) r5++;
    if (at >= 0) mrr += 1 / (at + 1); else misses.push(q);
  }
  const n = cases.length, f = (x) => (x / n).toFixed(2);
  console.log(`${name.padEnd(30)} recall@1 ${f(r1)}  recall@3 ${f(r3)}  recall@5 ${f(r5)}  MRR ${f(mrr)}${misses.length ? "   misses: " + misses.join(" | ") : ""}`);
  return { r3: r3 / n, mrr: mrr / n };
}
// exactly what production does: rewrite the question, then search with its intent and topic
const hybrid = () => (q) => { const rw = R.rewrite(q, []); return H.search(rw.query, { k: 10, intent: rw.intent, topic: rw.topic || undefined }).hits; };
const plain = (q) => H.bm25Search(q, 10);

console.log("\nRetrieval quality\n");
const kb = evaluate("knowledge: plain BM25", KNOWLEDGE, plain);
const kh = evaluate("knowledge: hybrid pipeline", KNOWLEDGE, hybrid());
const hb = evaluate("held-out: plain BM25", HELDOUT, plain);
const hh = evaluate("held-out: hybrid pipeline", HELDOUT, hybrid());
const pb = evaluate("products: plain BM25", PRODUCTS, plain);
const ph = evaluate("products: hybrid pipeline", PRODUCTS, hybrid());
console.log();
ok(kh.r3 >= 0.9, `hybrid finds the right guide or policy in the top 3 for at least 90% of questions (${kh.r3.toFixed(2)})`);
ok(kh.mrr > kb.mrr, `hybrid ranks knowledge better than plain BM25 (MRR ${kh.mrr.toFixed(2)} vs ${kb.mrr.toFixed(2)})`);
ok(hh.mrr > hb.mrr, `held-out questions: hybrid beats plain BM25 (MRR ${hh.mrr.toFixed(2)} vs ${hb.mrr.toFixed(2)})`);
ok(ph.mrr >= pb.mrr - 0.02, `hybrid does not hurt product lookup (MRR ${ph.mrr.toFixed(2)} vs ${pb.mrr.toFixed(2)})`);

console.log("\nGrounded answers\n");
const norm = (s) => s.replace(/\s+/g, " ").replace(/[.!?]+$/, "").trim().toLowerCase();
let answered = 0, rightLead = 0, badCite = 0, ungrounded = 0;
for (const [q, want] of KNOWLEDGE) {
  const a = A.knowledgeAnswer(q, []);
  if (!a) continue;
  answered++;
  if (want.includes(a.sources[0].id)) rightLead++;
  const bullets = a.text.split("\n").filter((l) => l.startsWith("- "));
  for (const b of bullets) {
    const cite = b.match(/\[(\d+)\]$/);
    if (!cite || Number(cite[1]) > a.sources.length) { badCite++; continue; }
    const body = norm(b.slice(2).replace(/\s*\[\d+\]$/, ""));
    const passage = norm(a.passages.find((p) => p.n === Number(cite[1]))?.text ?? "");
    if (!passage.includes(body)) ungrounded++;
  }
}
ok(answered / KNOWLEDGE.length >= 0.9, `answers ${answered} of ${KNOWLEDGE.length} knowledge questions`);
ok(rightLead / answered >= 0.9, `lead source is the right one for ${rightLead} of ${answered} answers`);
ok(badCite === 0, `every sentence carries a valid citation (${badCite} bad)`);
ok(ungrounded === 0, `every sentence is copied from its cited passage (${ungrounded} not found)`);
ok(A.validCitations("Good [1] and bad [7].", 2) === "Good [1] and bad .", "invented citations are stripped");

console.log("\nGuardrails and memory\n");
for (const q of OUT_OF_SCOPE) ok(A.knowledgeAnswer(q, []) === null, `declines out-of-scope: "${q}"`);
const hist = [{ role: "user", text: "I want to learn badminton" }, { role: "assistant", text: "Great!" }];
const fu = R.rewrite("what about for beginners?", hist);
ok(fu.topic === "badminton" && /badminton/.test(fu.query), `follow-up remembers the topic: "${fu.query}"`);
ok(R.followUpMessage("what about for beginners?", hist) === "what about for beginners? badminton", "short follow-up keeps the sport for product search");
ok(R.followUpMessage("show me running shoes", hist) === null, "a message that names its own sport is left alone");
const pr = R.rewrite("is it good for knees?", [], "BR 100 Racket");
ok(/BR 100 Racket/.test(pr.query), `"it" resolves to the product: "${pr.query}"`);
const ans = A.knowledgeAnswer("do I need a hydration belt", []);
ok(ans && ans.trace.confident && ans.trace.stages.length >= 4 && ans.trace.top.length > 0, "answers carry a retrieval trace");

console.log(fails ? `\n${fails} FAILED` : "\nall passed");
process.exit(fails ? 1 : 0);
