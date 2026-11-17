/**
 * The chatbot offers a kit on its own. When a shopper says they have just started a sport
 * ("I've started playing badminton"), it lists what most beginners need and offers to build the kit.
 * Answers about a kit sport also carry a "Help me build a … kit" chip.
 */
import { parsePrice } from "@/lib/rag/assistant";

type Sport = "badminton" | "marathon" | "yoga";

const SPORTS: Record<Sport, { re: RegExp; ask: string; show: string; text: string }> = {
  badminton: {
    re: /\b(badminton|shuttle(cock)?s?)\b/,
    ask: "Help me build a badminton kit",
    show: "Show badminton rackets",
    text:
      "Welcome to badminton! 🏸 Most beginners need just a few things to get playing:\n\n" +
      "- **Racket**\n- **Shuttlecocks**\n- **Court shoes**\n\n" +
      "A shirt and shorts, a kit bag and a grip are optional.\n\n" +
      "> 💡 Want me to build your kit? Tell me what you already have and I'll only suggest what you still need.",
  },
  marathon: {
    re: /\b(marathon|half[- ]marathon|running|run|jogging|5 ?k|10 ?k)\b/,
    ask: "Help me build a marathon kit",
    show: "Show running shoes",
    text:
      "Nice, welcome to running! 🏃 The essentials are:\n\n" +
      "- **Running shoes**\n- **Running socks**\n- **Running shorts**\n\n" +
      "A running top, a hydration belt, a cap and a GPS watch are optional, and mostly matter for longer runs.\n\n" +
      "> 💡 Want me to build your kit? I'll skip anything you already own.",
  },
  yoga: {
    re: /\byoga\b/,
    ask: "Help me build a yoga kit",
    show: "Show yoga mats",
    text:
      "Welcome to yoga! 🧘 To get started you mostly need:\n\n" +
      "- **Comfortable pants**\n- **A mat** (many studios lend one)\n\n" +
      "Blocks and a strap are optional.\n\n" +
      "> 💡 Want me to build your kit? Tell me what you already have and I'll only suggest what you still need.",
  },
};

const STARTED = /\b(start(ed|ing)|began|begin(ning)?|getting into|got into|picked up|taking up|took up|joined|learning|learn|new to|beginner|first time|play(ing)? (from|since) (today|yesterday|last))\b/;
/** Asking for a specific item or a budget is a shopping request, not a "just started" statement */
const SPECIFIC = /\b(rackets?|racquets?|shoes?|shorts|socks?|bags?|grips?|belt|watch|cap|visor|mats?|pants|leggings|kit|plan|weeks?|months?)\b/;

export function kitOffer(msg: string): { text: string; suggestions: string[] } | null {
  const lower = msg.toLowerCase();
  if (!STARTED.test(lower) || SPECIFIC.test(lower) || parsePrice(msg).range) return null;
  const sport = (Object.keys(SPORTS) as Sport[]).find((s) => SPORTS[s].re.test(lower));
  if (!sport) return null;
  const k = SPORTS[sport];
  return { text: k.text, suggestions: [k.ask, k.show, "What's on sale?"] };
}

/** A "build a kit" chip for answers about badminton or running gear, so the offer is always one tap away */
export function kitChip(products: { category: string }[] | undefined, suggestions: string[] | undefined): string[] | undefined {
  const cats = (products ?? []).map((p) => p.category);
  const ask = cats.some((c) => c.startsWith("Badminton") || c === "Shuttlecocks") ? SPORTS.badminton.ask
    : cats.some((c) => c.startsWith("Running") || c === "Hydration & Nutrition") ? SPORTS.marathon.ask : null;
  if (!ask || (suggestions ?? []).some((s) => /\bkit\b/i.test(s))) return suggestions;
  return [ask, ...(suggestions ?? [])].slice(0, 4);
}
