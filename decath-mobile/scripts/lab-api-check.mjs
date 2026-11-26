import { createJiti } from "jiti";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
const jiti = createJiti(import.meta.url, { alias: { "@": fileURLToPath(new URL("..", import.meta.url)) } });
const A = await jiti.import("@/app/api/lab/route.ts");
const C = await jiti.import("@/app/api/lab/community/route.ts");
const { DEFAULT_LAB } = await jiti.import("@/lib/lab/types.ts");
const { products } = await jiti.import("@/lib/products.ts");
const request = (value, method = "POST", origin = "http://localhost:3000") => new Request("http://localhost:3000/api/lab/community", { method, headers: { "Content-Type": "application/json", Origin: origin }, body: JSON.stringify(value) });
let checks = 0;
async function test(label, fn) { await fn(); checks++; console.log(`PASS ${label}`); }
await test("Lab API returns validated analysis and no-store response", async () => { const r = await A.POST(request(DEFAULT_LAB)); assert.equal(r.status, 200); assert.equal(r.headers.get("cache-control"), "no-store"); const d = await r.json(); assert(d.revision && d.sources.length && d.candidates.length); });
await test("Lab API rejects invalid JSON, wrong shape and oversized state", async () => {
  assert.equal((await A.POST(new Request("http://localhost/api/lab", { method: "POST", body: "{" }))).status, 400);
  assert.equal((await A.POST(request({ ...DEFAULT_LAB, budget: -1 }))).status, 400);
  assert.equal((await A.POST(new Request("http://localhost/api/lab", { method: "POST", body: " ".repeat(100001) }))).status, 413);
});
const temporary = await mkdtemp(path.join(os.tmpdir(), "gear-api-test-")); process.env.LAB_DATA_DIR = temporary;
const p = products.find(p => p.category === "Running Shoes");
const token = randomUUID(); const vote = { token, productId: p.id, size: p.sizes[0], fit: "right", consent: true };
try {
  await test("Community blocks cross-origin writes and missing consent", async () => { assert.equal((await C.POST(request(vote, "POST", "https://unrelated.example"))).status, 403); assert.equal((await C.POST(request({ ...vote, consent: false }))).status, 400); });
  await test("Community API saves, hides a small group, and deletes own data", async () => {
    assert.equal((await C.POST(request(vote))).status, 200);
    const r = await C.GET(); assert.equal(r.status, 200); assert.deepEqual((await r.json()).groups, []);
    assert.equal((await C.DELETE(request({ token }, "DELETE"))).status, 200);
  });
  await test("Community API rejects unlisted sizes and malformed tokens", async () => { assert.equal((await C.POST(request({ ...vote, size: "invented" }))).status, 400); assert.equal((await C.DELETE(request({ token: "not-a-token" }, "DELETE"))).status, 400); });
} finally { await rm(temporary, { recursive: true, force: true }); delete process.env.LAB_DATA_DIR; }
console.log(`\n${checks} API checks passed`);
