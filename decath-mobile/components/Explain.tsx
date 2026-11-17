"use client";

import { useState } from "react";
import { splitJargon, type Entry } from "@/lib/glossary";
import { BottomSheet } from "./ui";

/** Text where technical words are tappable and open a plain-language explanation. */
export default function Explain({ text }: { text: string }) {
  const [entry, setEntry] = useState<Entry | null>(null);
  const [shown, setShown] = useState<Entry | null>(null);
  const pieces = splitJargon(text);
  if (pieces.every((p) => !p.entry)) return <>{text}</>;

  return (
    <>
      {pieces.map((p, i) =>
        p.entry ? (
          <button key={i} type="button" onClick={() => { setEntry(p.entry!); setShown(p.entry!); }}
            className="underline decoration-dotted underline-offset-4 decoration-brand text-inherit">{p.text}</button>
        ) : (
          <span key={i}>{p.text}</span>
        ),
      )}
      <BottomSheet open={entry !== null} onClose={() => setEntry(null)} title={shown?.title ?? ""}>
        <p className="text-[16px] leading-relaxed">{shown?.plain}</p>
        <p className="text-xs text-muted mt-4">A general explanation of the term, not a claim about this product.</p>
      </BottomSheet>
    </>
  );
}
