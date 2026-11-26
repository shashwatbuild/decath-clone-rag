import { getProduct } from "@/lib/products";
import { FITTING_ASSETS } from "@/lib/tryon/assets";
export const runtime = "nodejs";
/** Fixed catalogue lookup, never an arbitrary-URL proxy. No camera data enters this route. */
export async function GET(req: Request) {
  const id = new URL(req.url).searchParams.get("product") ?? "";
  const entry = FITTING_ASSETS[id];
  const p = getProduct(id);
  if (!entry || !p) return Response.json({ error: "This item has no reviewed fitting asset." }, { status: 404 });
  const source = new URL(p.images[entry.image]);
  if (source.hostname !== "contents.mediadecathlon.com" || source.protocol !== "https:") return Response.json({ error: "Invalid catalogue asset." }, { status: 500 });
  source.searchParams.set("f", "900x900");
  try {
    const r = await fetch(source, { signal: AbortSignal.timeout(15000), redirect: "error", cache: "force-cache" });
    if (!r.ok || !r.headers.get("content-type")?.startsWith("image/")) throw new Error("Asset unavailable");
    const bytes = await r.arrayBuffer();
    if (bytes.byteLength > 8000000) throw new Error("Asset too large");
    return new Response(bytes, { headers: { "Content-Type": r.headers.get("content-type")!, "Cache-Control": "public, max-age=86400", "X-Content-Type-Options": "nosniff" } });
  } catch { return Response.json({ error: "The garment photo could not load. Please retry." }, { status: 502 }); }
}
