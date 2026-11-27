import { baseTokens } from "./index";
import { stem } from "./hybrid";

type Passage = { n: number; title: string; text: string };
const GENERIC = new Set('yes no here there their these those your our also only more most some based source according listed catalogue product products answer information'.split(' '));
const tokens = (s: string) => new Set(baseTokens(s).map(stem).filter(t => t.length > 2 && !GENERIC.has(t)));
const numbers = (s: string) => s.match(/\d+(?:[,.]\d+)*/g)?.map(n => n.replace(/,/g, '')) ?? [];

/** Conservative lexical gate, not an entailment model. Reject uncertain paraphrases rather than display unsupported claims. */
export function verifyGrounding(text: string, passages: Passage[]): { supported: boolean; reason: string } {
  if (!text.trim()) return { supported: false, reason: 'empty' };
  const sources = new Map(passages.map(p => [p.n, p]));
  const blocks = text.split(/\n+|(?<=[.!?])\s+(?=[A-Z])/).map(s => s.trim()).filter(Boolean);
  let claims = 0;
  for (const block of blocks) {
    // A short bold heading can label an answer; all factual prose must be cited.
    if (/^\*\*[^*\n]{1,100}\*\*[:.!?]?$/.test(block)) continue;
    const cites = [...block.matchAll(/\[(\d+)\]/g)].map(m => Number(m[1]));
    if (!cites.length || cites.some(n => !sources.has(n))) return { supported: false, reason: 'missing-or-invalid-citation' };
    const body = block.replace(/\[\d+\]/g, '').replace(/[*_>#]/g, '');
    const evidence = cites.map(n => sources.get(n)!.text).join(' ');
    const have = tokens(evidence), want = [...tokens(body)];
    if (numbers(body).some(n => !numbers(evidence).includes(n))) return { supported: false, reason: 'unsupported-number' };
    // Negation changes a claim even when nearly every word is copied.
    if (/\b(?:not|never|cannot|can't|no)\b/i.test(body) !== /\b(?:not|never|cannot|can't|no)\b/i.test(evidence)) return { supported: false, reason: 'uncertain-negation' };
    if (!want.length || want.filter(t => have.has(t)).length / want.length < .75) return { supported: false, reason: 'insufficient-source-overlap' };
    claims++;
  }
  return { supported: claims > 0, reason: claims ? 'supported-by-lexical-check' : 'no-claims' };
}
