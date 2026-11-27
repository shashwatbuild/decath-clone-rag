/**
 * Query understanding: turns the shopper's latest message into a better search query.
 *
 *  - remembers the topic from earlier in the chat ("what about for beginners?" after a badminton question)
 *  - resolves "it" / "this" to the product being discussed
 *  - decides whether the question is a how-to / explanation or a fact lookup
 *
 * Rule-based on purpose: it is instant, free and testable, and runs whether or not an LLM is configured.
 */
import { tokenize } from "./index";

export type Turn = { role: "user" | "assistant"; text: string };
export type Rewrite = { query: string; topic: string; intent: "howto" | "fact"; notes: string[] };

const TOPICS: [string, RegExp][] = [
  ["badminton", /\b(badminton|rackets?|racquets?|shuttle(cock)?s?|court shoes)\b/],
  ["running", /\b(running|marathon|half[- ]marathon|jogging|runner|10 ?k|5 ?k|kiprun)\b/],
  ["yoga", /\b(yoga|pilates|asana)\b/],
  ["hiking", /\b(trek(king)?|hik(e|ing)|backpacks?|rucksack|camping)\b/],
  ["cycling", /\b(cycles?|bikes?|bicycles?|cycling|mtb)\b/],
  ["football", /\b(football|soccer)\b/],
];

export const topicOf = (text: string): string => TOPICS.find(([, re]) => re.test(text.toLowerCase()))?.[0] ?? "";

/** Store policies and how-the-app-works topics: answered from the policy documents */
const STORE = /\b(returns?|refunds?|exchange|warranty|delivery|shipping|pickup|coupons?|promo|payments?|pay|wallet|checkout|cash on delivery|cod|size finder|price watch|training plan|kits?|find (my|the right) size|size guide|alerts?)\b/i;

const EXPLAIN_CUE = /\b(choose|choosing|difference|vs\.?|versus|explain|guide|tips?|meaning|mean|what (is|are) (a|an|the)?\s?\w+|how (to|do|does|much|many|long|often)|do i need|why)\b/i;
const SHOPPING_CUE = /\b(lightest|cheapest|heaviest|best|top|under|below|above|budget|show me|list|recommend|suggest|i (want|need)|looking for|buy)\b|₹|\b\d+\s?k\b/i;

/**
 * "how to choose a racket", "what is drop?", "feather or plastic?": the shopper wants an explanation, so the
 * cited knowledge answer comes first and the guided advisor is offered afterwards. "I want a racket under 500"
 * or "lightest backpack" are shopping requests and still start the advisor.
 */
export function isExplanation(message: string): boolean {
  const m = message.trim();
  return /^(how|why|what|which|when|can|could|do|does|is|are|should)\b/i.test(m) && EXPLAIN_CUE.test(m) && !SHOPPING_CUE.test(m);
}

/** Question-shaped messages ask for an explanation or advice; bare names and specs ("BR 100 racket") are lookups */
const HOWTO = /^(how|why|what|which|when|can|could|do|does|is|are|should|will)\b|\b(difference|vs\.?|versus|explain|guide|choose|choosing|should i|do i need|tips?|meaning)\b/i;

/**
 * A short follow-up with no sport in it ("what about for beginners?") gets the topic of the last few turns
 * appended, so the normal product search stays on the same sport. Returns null when nothing needs adding.
 */
export function followUpMessage(message: string, history: Turn[]): string | null {
  if (topicOf(message)) return null;
  const content = tokenize(message).filter((t) => t.length > 2);
  if (content.length > 4) return null;
  for (const t of [...history].reverse().filter((h) => h.role === "user").slice(0, 3)) {
    const topic = topicOf(t.text);
    if (topic) return `${message} ${topic}`;
  }
  return null;
}

export function rewrite(message: string, history: Turn[], focusName?: string): Rewrite {
  const notes: string[] = [];
  let query = message.trim();
  let topic = topicOf(query);
  // An explicit store question takes precedence over an unrelated sport in chat history.
  if (!topic && STORE.test(message)) topic = "store";

  // Memory: the topic of the last few things the shopper said
  if (!topic) {
    const earlier = [...history].reverse().filter((t) => t.role === "user").slice(0, 3);
    for (const t of earlier) {
      topic = topicOf(t.text);
      if (topic) break;
    }
    const content = tokenize(query).filter((t) => t.length > 2);
    if (topic && content.length <= 4) {
      query = `${query} ${topic}`;
      notes.push(`Added the topic "${topic}" from earlier in the chat`);
    } else if (topic) {
      notes.push(`Topic "${topic}" taken from earlier in the chat (used to prefer on-topic guides)`);
    }
  } else {
    notes.push(`Topic detected: ${topic}`);
  }

  // Pronouns: "is it good for knees?" -> name the product
  if (focusName && /\b(it|this|that|these|they)\b/i.test(query)) {
    query = `${query} ${focusName}`;
    notes.push(`Resolved "it" to ${focusName}`);
  }

  if (!topic && STORE.test(message)) {
    topic = "store";
    notes.push("Store question: the store policies are preferred");
  }

  // "how do I find my size" loses "find" as a stop word and becomes just "size": say what is meant
  if (/\b(find|know|get|which|what)\b.{0,12}\bsize\b|\bsize (guide|finder|chart)\b/i.test(message) && !/size finder/i.test(query)) {
    query = `${query} size finder`;
    notes.push('Added "size finder" (the question is about finding a size)');
  }

  const intent = HOWTO.test(message) || STORE.test(message) ? "howto" : "fact";
  notes.push(intent === "howto" ? "Looks like an explanation or how-to question, so guides are preferred" : "Looks like a fact lookup, so specs and benefits are preferred");
  return { query, topic, intent, notes };
}
