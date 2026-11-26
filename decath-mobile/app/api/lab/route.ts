import { parseLabInput, LabInputError } from "@/lib/lab/input";
import { analyzeLab } from "@/lib/lab/engine";
export const runtime = "nodejs";
export async function POST(req: Request) {
  try {
    const body = await req.text();
    if (body.length > 100000) return Response.json({ error: "Lab state is too large. Export and clear older gear logs." }, { status: 413 });
    const input = parseLabInput(JSON.parse(body));
    return Response.json(analyzeLab(input), { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof LabInputError || error instanceof SyntaxError) return Response.json({ error: error.message }, { status: 400 });
    console.error("Lab analysis failed", error);
    return Response.json({ error: "The Lab could not refresh. Your saved brief is still available; please retry." }, { status: 500 });
  }
}
