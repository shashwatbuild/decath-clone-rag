/**
 * Renders the assistant's replies (a small Markdown subset) as clean chat UI:
 *   **bold**, ~~strike~~, _italic_ / *italic*
 *   "1. Name" + indented next line    -> numbered product row (badge matches the product cards)
 *   "- item" / "• item" / "* item"    -> bullet list (indented next lines become a muted sub-line)
 *   "> text"                          -> highlighted callout (my pick, tips, offers)
 *   "# Heading"                       -> bold heading
 * Blank lines separate paragraphs. Works for the offline replies and for LLM (Gemini / Claude) output.
 */
import { Fragment, type ReactNode } from "react";

type Item = { marker: string; text: string; sub: string[] };
type Block =
  | { kind: "p"; lines: string[] }
  | { kind: "h"; text: string }
  | { kind: "quote"; lines: string[] }
  | { kind: "ol" | "ul"; items: Item[] };

const OL = /^\s{0,1}(\d+)[.)]\s+(.*)$/;
const UL = /^\s{0,1}[-•*]\s+(.*)$/;
const SUB = /^\s{2,}(\S.*)$/;

function parse(text: string): Block[] {
  const blocks: Block[] = [];
  const last = () => blocks[blocks.length - 1];
  for (const raw of text.replace(/\r/g, "").split("\n")) {
    const line = raw.replace(/\s+$/, "");
    if (!line.trim()) { blocks.push({ kind: "p", lines: [] }); continue; }
    let m: RegExpMatchArray | null;
    if ((m = line.match(/^#{1,4}\s+(.*)$/))) { blocks.push({ kind: "h", text: m[1] }); continue; }
    if ((m = line.match(/^>\s?(.*)$/))) {
      const b = last();
      if (b?.kind === "quote") b.lines.push(m[1]); else blocks.push({ kind: "quote", lines: [m[1]] });
      continue;
    }
    if ((m = line.match(OL)) || (m = line.match(UL))) {
      const kind = line.match(OL) ? "ol" : "ul";
      const item: Item = kind === "ol" ? { marker: m[1], text: m[2], sub: [] } : { marker: "", text: m[1], sub: [] };
      const b = last();
      if (b?.kind === kind) b.items.push(item); else blocks.push({ kind, items: [item] });
      continue;
    }
    if ((m = line.match(SUB))) {
      const b = last();
      if (b?.kind === "ol" || b?.kind === "ul") { b.items[b.items.length - 1].sub.push(m[1]); continue; }
    }
    const b = last();
    if (b?.kind === "p" && b.lines.length) b.lines.push(line.trim()); else blocks.push({ kind: "p", lines: [line.trim()] });
  }
  return blocks.filter((b) => !(b.kind === "p" && !b.lines.length));
}

/** Inline formatting: **bold**, ~~strike~~, _italic_ / *italic* */
function inline(text: string): ReactNode[] {
  const out: ReactNode[] = [];
  const re = /\*\*(.+?)\*\*|~~(.+?)~~|(?<![\w*])_(.+?)_(?![\w])|(?<![\w*])\*(?!\s)(.+?)(?<!\s)\*(?![\w*])/g;
  let last = 0, m: RegExpExecArray | null, k = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    if (m[1] !== undefined) out.push(<strong key={k++} className="font-semibold text-ink">{inline(m[1])}</strong>);
    else if (m[2] !== undefined) out.push(<s key={k++} className="text-[#8a8a8a]">{m[2]}</s>);
    else out.push(<em key={k++} className="text-muted not-italic text-[14px]">{m[3] ?? m[4]}</em>);
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

export default function RichText({ text }: { text: string }) {
  const blocks = parse(text);
  return (
    <div className="space-y-2.5 text-[15px] leading-[1.5] text-[#1d1d1f]">
      {blocks.map((b, i) => {
        switch (b.kind) {
          case "h":
            return <p key={i} className="font-semibold text-[15.5px]">{inline(b.text)}</p>;
          case "p":
            return (
              <p key={i}>
                {b.lines.map((l, j) => (
                  <Fragment key={j}>{j > 0 && <br />}{inline(l)}</Fragment>
                ))}
              </p>
            );
          case "quote":
            return (
              <div key={i} className="rounded-xl bg-white border-l-[3px] border-brand px-3 py-2.5 text-[14.5px] shadow-[0_1px_0_rgba(0,0,0,0.03)]">
                {b.lines.map((l, j) => (
                  <p key={j} className={j ? "mt-1" : ""}>{inline(l)}</p>
                ))}
              </div>
            );
          case "ol":
            return (
              <ol key={i} className="space-y-2">
                {b.items.map((it, j) => (
                  <li key={j} className="flex gap-2.5">
                    <span className="mt-[1px] w-[22px] h-[22px] shrink-0 rounded-full bg-white text-brand text-[12px] font-semibold grid place-items-center ring-1 ring-[#d6d9f0]">
                      {it.marker}
                    </span>
                    <div className="min-w-0">
                      <p className="leading-snug">{inline(it.text)}</p>
                      {it.sub.map((s, k) => (
                        <p key={k} className="text-[13.5px] text-[#5f6168] mt-0.5 leading-snug">{inline(s)}</p>
                      ))}
                    </div>
                  </li>
                ))}
              </ol>
            );
          case "ul":
            return (
              <ul key={i} className="space-y-1.5">
                {b.items.map((it, j) => (
                  <li key={j} className="flex gap-2">
                    <span className="mt-[9px] w-[5px] h-[5px] shrink-0 rounded-full bg-brand" />
                    <div className="min-w-0">
                      <p>{inline(it.text)}</p>
                      {it.sub.map((s, k) => (
                        <p key={k} className="text-[13.5px] text-[#5f6168] leading-snug">{inline(s)}</p>
                      ))}
                    </div>
                  </li>
                ))}
              </ul>
            );
        }
      })}
    </div>
  );
}
