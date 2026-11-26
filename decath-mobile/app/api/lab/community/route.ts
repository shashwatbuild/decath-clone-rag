import { readCommunity, contribute, forgetContributions } from "@/lib/lab/community";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET() {
  try { return Response.json(await readCommunity(), { headers: { "Cache-Control": "no-store" } }); }
  catch { return Response.json({ error: "Community data is temporarily unavailable." }, { status: 503 }); }
}
async function write(req: Request, remove: boolean) {
  const origin = req.headers.get("origin");
  if (origin && origin !== new URL(req.url).origin) return Response.json({ error: "Cross-site submissions are not accepted." }, { status: 403 });
  if (!req.headers.get("content-type")?.includes("application/json")) return Response.json({ error: "Use a JSON request." }, { status: 415 });
  const text = await req.text();
  if (text.length > 2048) return Response.json({ error: "Submission is too large." }, { status: 413 });
  let body;
  try { body = JSON.parse(text); }
  catch { return Response.json({ error: "Invalid JSON." }, { status: 400 }); }
  try {
    if (remove) await forgetContributions(body?.token); else await contribute(body);
    return Response.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Could not save contribution.";
    return Response.json({ error: message }, { status: /required|Select|Expected/.test(message) ? 400 : 503 });
  }
}
export const POST = (req: Request) => write(req, false);
export const DELETE = (req: Request) => write(req, true);
