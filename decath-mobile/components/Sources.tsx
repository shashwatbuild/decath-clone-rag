"use client";

import Link from "next/link";
import type { RagTrace, Source } from "@/lib/types";

const KIND: Record<Source["kind"], string> = { guide: "Guide", policy: "Store policy", product: "Product page" };

/** The numbered sources behind an answer, plus a "how I found this" panel showing the retrieval steps. */
export default function Sources({ sources, trace }: { sources: Source[]; trace?: RagTrace }) {
  return (
    <div className="mt-3 max-w-[94%]">
      <p className="text-[12px] font-semibold uppercase tracking-wide text-muted">Sources</p>
      <ul className="mt-2 space-y-2">
        {sources.map((s) => (
          <li key={s.n}>
            <Link href={s.url} className="flex items-start gap-2 rounded-xl border border-line bg-white px-3 py-3 hover:border-brand">
              <span className="mt-0.5 grid h-5 min-w-5 place-items-center rounded-full bg-brand-soft px-1 text-[11px] font-bold text-brand">{s.n}</span>
              <span className="min-w-0">
                <span className="block text-[13px] leading-relaxed font-medium text-ink">{s.title}</span>
                <span className="block text-[11px] text-muted">{KIND[s.kind]}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>

      {trace && (
        <details className="mt-1.5 text-[12px] text-muted">
          <summary className="cursor-pointer select-none py-1 font-medium text-brand">How I found this</summary>
          <div className="space-y-3 rounded-xl bg-white p-4 border border-line">
            <p><b className="text-ink">Search used:</b> {trace.rewritten}</p>
            {trace.notes.length > 0 && (
              <ul className="list-disc pl-4 space-y-0.5">{trace.notes.map((n) => <li key={n}>{n}</li>)}</ul>
            )}
            <p><b className="text-ink">Steps:</b> {trace.stages.join(" → ")}</p>
            <div>
              <p className="font-medium text-ink">Best passages (keyword · fuzzy · final)</p>
              <ul className="mt-0.5 space-y-0.5">
                {trace.top.map((t) => (
                  <li key={t.id} className="flex justify-between gap-2">
                    <span className="truncate">{t.title}</span>
                    <span className="shrink-0 tabular-nums">{t.bm25.toFixed(1)} · {t.ngram.toFixed(2)} · {t.score.toFixed(2)}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </details>
      )}
    </div>
  );
}
