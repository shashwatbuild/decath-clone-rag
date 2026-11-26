"use client";

import Link from "next/link";
import type { RagTrace, Source } from "@/lib/types";

const KIND: Record<Source["kind"], string> = { guide: "Guide", policy: "Store policy", product: "Product page" };

/** Shopper-facing source links. Retrieval diagnostics remain in the API response. */
export default function Sources({ sources }: { sources: Source[]; trace?: RagTrace }) {
  return (
    <div className="mt-3 max-w-[94%]">
      <p className="text-[12px] font-semibold tracking-wide text-muted">Sources</p>
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


    </div>
  );
}
