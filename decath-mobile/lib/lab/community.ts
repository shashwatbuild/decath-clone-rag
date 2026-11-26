import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile, rename, open, unlink } from "node:fs/promises";
import path from "node:path";
import { getProduct } from "../products";

export type FitVote = "small" | "right" | "large";
export type CommunityRecord = { contributor: string; productId: string; size: string; fit: FitVote; at: number };
export const MIN_COHORT = 5;
const dir = () => process.env.LAB_DATA_DIR || path.join(process.cwd(), ".local", "gear-lab");
const tokenHash = (token: unknown) => {
  if (typeof token !== "string" || !/^[a-f0-9-]{36}$/i.test(token)) throw new Error("A valid device contribution token is required.");
  return createHash("sha256").update(token).digest("hex");
};
export function validateContribution(value: unknown) {
  if (!value || typeof value !== "object") throw new Error("Expected a contribution.");
  const x = value as Record<string, unknown>;
  const contributor = tokenHash(x.token);
  if (x.consent !== true) throw new Error("Explicit sharing consent is required.");
  const p = typeof x.productId === "string" ? getProduct(x.productId) : null;
  if (!p || typeof x.size !== "string" || !(p.sizes.length ? p.sizes.includes(x.size) : x.size === "One size")) throw new Error("Select a listed product size.");
  if (!["small", "right", "large"].includes(String(x.fit))) throw new Error("Select how the item fit.");
  return { contributor, productId: p.id, size: x.size, fit: x.fit as FitVote, at: Date.now() };
}
export function aggregateCommunity(records: CommunityRecord[]) {
  const groups = new Map<string, CommunityRecord[]>();
  const cutoff = Date.now() - 180 * 86400000;
  for (const r of records.filter(r => r.at >= cutoff)) {
    const key = `${r.productId}:${r.size}`;
    groups.set(key, [...(groups.get(key) ?? []).filter(x => x.contributor !== r.contributor), r]);
  }
  return [...groups.values()].filter(g => g.length >= MIN_COHORT).map(g => ({
    productId: g[0].productId, size: g[0].size, participants: g.length,
    small: g.filter(r => r.fit === "small").length, right: g.filter(r => r.fit === "right").length, large: g.filter(r => r.fit === "large").length,
  }));
}
async function readRecords(): Promise<CommunityRecord[]> {
  try { return JSON.parse(await readFile(path.join(dir(), "community.json"), "utf8")); }
  catch (e) { if ((e as NodeJS.ErrnoException).code === "ENOENT") return []; throw e; }
}
/** Atomic file replacement plus a cross-process exclusive write lock. A persistent single-host volume
 * is required in deployment; this intentionally does not pretend to be a multi-region database.
 */
async function mutate(update: (records: CommunityRecord[]) => CommunityRecord[]) {
  await mkdir(dir(), { recursive: true });
  const lockPath = path.join(dir(), "community.lock");
  let lock;
  for (let i = 0; i < 20; i++) {
    try { lock = await open(lockPath, "wx", 0o600); break; }
    catch (e) { if ((e as NodeJS.ErrnoException).code !== "EEXIST") throw e; await new Promise(r => setTimeout(r, 50)); }
  }
  if (!lock) throw new Error("Community storage is busy. Try again shortly.");
  const temporary = path.join(dir(), `${randomUUID()}.tmp`);
  try {
    const records = update((await readRecords()).filter(r => r.at >= Date.now() - 180 * 86400000));
    if (records.length > 10000) throw new Error("Community storage is full. Try again after maintenance.");
    await writeFile(temporary, JSON.stringify(records), { mode: 0o600 });
    await rename(temporary, path.join(dir(), "community.json"));
  } finally { await unlink(temporary).catch(() => {}); await lock.close(); await unlink(lockPath).catch(() => {}); }
}
export const readCommunity = async () => ({ minimum: MIN_COHORT, groups: aggregateCommunity(await readRecords()) });
export async function contribute(value: unknown) {
  const vote = validateContribution(value);
  await mutate(records => [...records.filter(r => !(r.contributor === vote.contributor && r.productId === vote.productId && r.size === vote.size)), vote]);
}
export async function forgetContributions(token: unknown) {
  const contributor = tokenHash(token);
  await mutate(records => records.filter(r => r.contributor !== contributor));
}
