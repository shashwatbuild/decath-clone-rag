/** Durable community feedback for serverless deployments (Upstash REST / Vercel Marketplace). */
type StoredVote = { contributor: string; productId: string; size: string; fit: "small" | "right" | "large"; at: number };
const KEY = "decath:community:fit:v1";
export function communityRedisConfigured() {
  const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
  if (!url && !token) return false;
  if (!url || !token) throw new Error("Community storage needs both its REST URL and token.");
  const endpoint = new URL(url);
  if (endpoint.protocol !== "https:" || endpoint.username || endpoint.password || endpoint.search || endpoint.hash) {
    throw new Error("Community storage requires a secure REST endpoint.");
  }
  return true;
}
async function command<T>(args: (string | number)[]): Promise<T> {
  if (!communityRedisConfigured()) throw new Error("Community storage is not configured.");
  const response = await fetch(process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL!, {
    method: "POST", headers: { Authorization: `Bearer ${process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify(args), cache: "no-store", signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) throw new Error("Community storage is temporarily unavailable.");
  const data = await response.json() as { result?: T; error?: string };
  if (data.error || !("result" in data)) throw new Error("Community storage could not complete the request.");
  return data.result as T;
}
export async function readRedisCommunity(): Promise<StoredVote[]> {
  const values = await command<string[]>(["HVALS", KEY]);
  if (!Array.isArray(values)) throw new Error("Community storage returned an invalid response.");
  return values.map(value => JSON.parse(value) as StoredVote);
}
// Pruning, capacity check and replacement execute atomically on Redis, across function instances.
export const SAVE_VOTE = `
local entries = redis.call('HGETALL', KEYS[1])
for i = 1, #entries, 2 do
  local vote = cjson.decode(entries[i + 1])
  if vote.at < tonumber(ARGV[3]) then redis.call('HDEL', KEYS[1], entries[i]) end
end
if redis.call('HLEN', KEYS[1]) >= 10000 and redis.call('HEXISTS', KEYS[1], ARGV[1]) == 0 then return 0 end
redis.call('HSET', KEYS[1], ARGV[1], ARGV[2])
redis.call('EXPIRE', KEYS[1], 15552000)
return 1`;
export async function saveRedisContribution(vote: StoredVote) {
  const field = `${vote.contributor}:${vote.productId}:${vote.size}`;
  const saved = await command<number>(["EVAL", SAVE_VOTE, 1, KEY, field, JSON.stringify(vote), Date.now() - 180 * 86400000]);
  if (saved !== 1) throw new Error("Community storage is full. Try again after maintenance.");
}
export const FORGET_VOTES = `
local fields = redis.call('HKEYS', KEYS[1])
local removed = 0
for _, field in ipairs(fields) do
  if string.sub(field, 1, string.len(ARGV[1])) == ARGV[1] then
    removed = removed + redis.call('HDEL', KEYS[1], field)
  end
end
return removed`;
export async function forgetRedisContributions(contributor: string) {
  await command<number>(["EVAL", FORGET_VOTES, 1, KEY, `${contributor}:`]);
}
