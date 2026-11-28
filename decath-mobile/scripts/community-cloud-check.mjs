import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { createJiti } from "jiti";
import { fileURLToPath } from "node:url";
const jiti = createJiti(import.meta.url, { alias: { "@": fileURLToPath(new URL("..", import.meta.url)) } });
const C = await jiti.import("@/app/api/lab/community/route.ts");
const { products } = await jiti.import("@/lib/products.ts");
const originalFetch = globalThis.fetch;
const names = ["VERCEL", "UPSTASH_REDIS_REST_URL", "UPSTASH_REDIS_REST_TOKEN", "KV_REST_API_URL", "KV_REST_API_TOKEN"];
const originalEnv = Object.fromEntries(names.map(n => [n, process.env[n]]));
const p = products.find(p => p.category === "Running Shoes");
const token = randomUUID();
const vote = { token, productId: p.id, size: p.sizes[0], fit: "right", consent: true };
const request = value => new Request("https://demo.example/api/lab/community", { method: "POST", headers: { Origin: "https://demo.example", "Content-Type": "application/json" }, body: JSON.stringify(value) });
let checks = 0;
async function test(label, fn) { await fn(); checks++; console.log(`PASS ${label}`); }
try {
  for (const n of names) delete process.env[n];
  process.env.VERCEL = "1";
  await test("Serverless deployment refuses ephemeral community persistence", async () => {
    assert.equal((await C.GET()).status, 503);
    assert.equal((await C.POST(request(vote))).status, 503);
  });
  process.env.UPSTASH_REDIS_REST_URL = "https://example.upstash.io";
  process.env.UPSTASH_REDIS_REST_TOKEN = "test-only-token";
  let lastCommand;
  globalThis.fetch = async (url, init) => {
    assert.equal(url, "https://example.upstash.io");
    assert.equal(init.cache, "no-store");
    assert.equal(init.headers.Authorization, "Bearer test-only-token");
    lastCommand = JSON.parse(init.body);
    return Response.json({ result: lastCommand[0] === "HVALS" ? Array.from({ length: 5 }, (_, i) => JSON.stringify({ contributor: `hash-${i}`, productId: p.id, size: p.sizes[0], fit: "right", at: Date.now() })) : 1 });
  };
  await test("Hosted aggregate reads preserve cohort privacy and never return contributor identities", async () => {
    const response = await C.GET(); const result = await response.json();
    assert.equal(response.status, 200); assert.equal(result.groups[0].participants, 5);
    assert.equal(result.groups[0].right, 5); assert(!JSON.stringify(result).includes("hash-"));
  });
  await test("Hosted writes send a hashed identity to an atomic Redis operation", async () => {
    assert.equal((await C.POST(request(vote))).status, 200);
    assert.equal(lastCommand[0], "EVAL"); assert.equal(lastCommand[2], 1);
    const record = JSON.parse(lastCommand[5]);
    assert.equal(record.contributor, createHash("sha256").update(token).digest("hex"));
    assert.equal(record.productId, p.id); assert(!JSON.stringify(lastCommand).includes(token));
  });
  await test("Hosted deletion is scoped to this device's hashed contribution prefix", async () => {
    const req = new Request("https://demo.example/api/lab/community", { method: "DELETE", headers: { Origin: "https://demo.example", "Content-Type": "application/json" }, body: JSON.stringify({ token }) });
    assert.equal((await C.DELETE(req)).status, 200);
    assert.equal(lastCommand[4], `${createHash("sha256").update(token).digest("hex")}:`);
  });
  await test("Storage errors are reported without exposing credentials or provider details", async () => {
    globalThis.fetch = async () => Response.json({ error: "test-only-token private provider detail" }, { status: 403 });
    const response = await C.POST(request(vote));
    assert.equal(response.status, 503); assert(!(await response.text()).includes("test-only-token"));
  });
  await test("Insecure Redis endpoint configurations are rejected before networking", async () => {
    process.env.UPSTASH_REDIS_REST_URL = "http://example.upstash.io";
    globalThis.fetch = async () => { throw new Error("Unexpected network call"); };
    assert.equal((await C.GET()).status, 503);
  });
} finally {
  globalThis.fetch = originalFetch;
  for (const [n, v] of Object.entries(originalEnv)) { if (v === undefined) delete process.env[n]; else process.env[n] = v; }
}
console.log(`\n${checks} hosted community checks passed (REST mocked; live Redis validation follows provisioning).`);
