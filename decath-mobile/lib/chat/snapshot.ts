import type { ChatMessage } from "@/lib/types";
import type { Session } from "@/lib/advisor/session";
import { getProduct, toLite } from "@/lib/products";
import { PROFILES } from "@/lib/advisor/profiles";
export type PendingStart = {
  msg: string;
  options: { id: string; label: string }[];
} | null;
export type ChatSnapshot = {
  version: 1;
  messages: ChatMessage[];
  input: string;
  session: Session | null;
  handledLinks: string[];
  pendingStart: PendingStart;
};
const object = (v: unknown): Record<string, unknown> | null =>
  v && typeof v === "object" && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : null;
export function parseChatSnapshot(raw: unknown): ChatSnapshot {
  const s = object(raw);
  if (
    !s ||
    s.version !== 1 ||
    !Array.isArray(s.messages) ||
    s.messages.length > 1000
  )
    throw Error("Invalid saved conversation");
  const messages: ChatMessage[] = s.messages.map((value) => {
    const m = object(value);
    if (
      !m ||
      !["user", "assistant"].includes(String(m.role)) ||
      typeof m.text !== "string" ||
      m.text.length > 50000 ||
      typeof m.time !== "number" ||
      !Number.isFinite(m.time)
    )
      throw Error("Invalid saved message");
    const result: ChatMessage = {
      role: m.role as ChatMessage["role"],
      text: m.text,
      time: m.time,
    };
    if (Array.isArray(m.products))
      result.products = m.products
        .map((p) => getProduct(String(object(p)?.id)))
        .filter((p) => !!p)
        .map((p) => toLite(p!))
        .slice(0, 20);
    if (Array.isArray(m.suggestions))
      result.suggestions = m.suggestions
        .filter((v): v is string => typeof v === "string" && v.length <= 1000)
        .slice(0, 12);
    if (typeof m.cards === "string" && /^[\w-]{1,60}$/.test(m.cards))
      result.cards = m.cards;
    if (Array.isArray(m.sources))
      result.sources = m.sources
        .flatMap((v) => {
          const r = object(v);
          return r &&
            Number.isInteger(r.n) &&
            typeof r.id === "string" &&
            typeof r.title === "string" &&
            typeof r.snippet === "string" &&
            typeof r.url === "string" &&
            /^\/(?:p|guides)\/[\w-]+$/.test(r.url) &&
            ["policy", "guide", "product"].includes(String(r.kind))
            ? [r as unknown as NonNullable<ChatMessage["sources"]>[number]]
            : [];
        })
        .slice(0, 12);
    const compare = object(m.compare);
    if (
      compare &&
      Array.isArray(compare.products) &&
      Array.isArray(compare.rows)
    ) {
      const ps = compare.products
        .map((p) => getProduct(String(object(p)?.id)))
        .filter((p) => !!p)
        .map((p) => toLite(p!));
      const rows = compare.rows.flatMap((value) => {
        const r = object(value);
        return r &&
          typeof r.label === "string" &&
          Array.isArray(r.values) &&
          r.values.length === ps.length &&
          r.values.every((v) => typeof v === "string")
          ? [{ label: r.label, values: r.values as string[] }]
          : [];
      });
      if (ps.length && ps.length <= 6)
        result.compare = { products: ps, rows: rows.slice(0, 30) };
    }
    return result;
  });
  const candidate = object(s.session),
    brief = object(candidate?.brief);
  const validSession =
    candidate &&
    brief &&
    typeof brief.profile === "string" &&
    Object.hasOwn(PROFILES, brief.profile) &&
    object(brief.values) &&
    object(brief.must) &&
    Array.isArray(candidate.queue) &&
    Array.isArray(candidate.selected) &&
    Array.isArray(candidate.undo) &&
    Array.isArray(candidate.skipped) &&
    typeof candidate.anchor === "number" &&
    candidate.anchor >= 0 &&
    candidate.anchor < messages.length &&
    typeof candidate.ready === "boolean";
  const pending = object(s.pendingStart);
  return {
    version: 1,
    messages,
    input: typeof s.input === "string" ? s.input.slice(0, 5000) : "",
    session: validSession ? (candidate as unknown as Session) : null,
    handledLinks: Array.isArray(s.handledLinks)
      ? s.handledLinks
          .filter((v): v is string => typeof v === "string")
          .slice(-100)
      : [],
    pendingStart:
      pending &&
      typeof pending.msg === "string" &&
      Array.isArray(pending.options) &&
      pending.options.every((o) => {
        const v = object(o);
        return v && typeof v.id === "string" && typeof v.label === "string";
      })
        ? (pending as unknown as PendingStart)
        : null,
  };
}
