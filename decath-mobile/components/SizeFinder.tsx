"use client";

import { useState } from "react";
import type { Product } from "@/lib/types";
import { sizeMode, suggest } from "@/lib/sizing";
import { BottomSheet } from "./ui";

const FIELDS = {
  apparel: [{ key: "height", label: "Height (cm)", ph: "170" }, { key: "weight", label: "Weight (kg)", ph: "65" }],
  frame: [{ key: "height", label: "Height (cm)", ph: "170" }],
  shoe: [{ key: "foot", label: "Foot length (cm)", ph: "26" }],
} as const;

export default function SizeFinder({ p, onPick }: { p: Product; onPick: (size: string) => void }) {
  const mode = sizeMode(p);
  const [open, setOpen] = useState(false);
  const [vals, setVals] = useState<Record<string, string>>({});
  if (!mode) return null;

  const result = suggest(p, mode, { height: Number(vals.height) || undefined, weight: Number(vals.weight) || undefined, foot: Number(vals.foot) || undefined });

  return (
    <>
      <button onClick={() => setOpen(true)} className="mt-3 text-brand font-semibold text-[15px] underline">Not sure? Find my size</button>
      <BottomSheet open={open} onClose={() => setOpen(false)} title="Find my size">
        <div className="space-y-3">
          {FIELDS[mode].map((f) => (
            <div key={f.key}>
              <label htmlFor={`sf-${f.key}`} className="text-sm text-muted">{f.label}</label>
              <input id={`sf-${f.key}`} inputMode="decimal" placeholder={f.ph} value={vals[f.key] ?? ""}
                onChange={(e) => setVals((v) => ({ ...v, [f.key]: e.target.value.replace(/[^\d.]/g, "").slice(0, 5) }))}
                className="mt-1 w-full border border-line rounded-lg px-4 py-3 text-base outline-none focus:border-brand" />
            </div>
          ))}
        </div>

        {result ? (
          <div className="mt-5 rounded-xl bg-[#F0F8F4] p-4">
            <p className="text-sm text-muted">We suggest</p>
            <p className="text-2xl font-bold">{result.label}</p>
            {result.option ? (
              <button onClick={() => { onPick(result.option!); setOpen(false); }}
                className="mt-3 w-full bg-brand text-white rounded-full py-3 font-semibold">Select {result.option}</button>
            ) : (
              <p className="text-sm mt-2">That size isn&apos;t listed for this product. Check the size chart.</p>
            )}
            <p className="text-xs text-muted mt-3">{result.note}</p>
          </div>
        ) : (
          <p className="text-sm text-muted mt-5">Enter your measurements to see a suggestion.</p>
        )}
      </BottomSheet>
    </>
  );
}
