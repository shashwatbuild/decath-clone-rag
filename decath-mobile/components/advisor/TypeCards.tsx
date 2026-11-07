"use client";

/** Visual, multi-select cards for the first personalisation question (e.g. type of yoga pants). */
import { useState } from "react";
import { img, inr } from "@/lib/products";
import type { Brief } from "@/lib/advisor/engine";
import { HELP, cardsFor } from "@/lib/advisor/session";
import { PROFILES, criterion } from "@/lib/advisor/profiles";

export default function TypeCards({ brief, id, onAnswer, active }: { brief: Brief; id: string; onAnswer: (text: string) => void; active: boolean }) {
  const [picked, setPicked] = useState<string[]>([]);
  const c = criterion(PROFILES[brief.profile], id);
  if (!c) return null; // the activity changed since this question was asked
  const cards = cardsFor(brief, id);
  const toggle = (k: string) => setPicked((p) => (p.includes(k) ? p.filter((x) => x !== k) : [...p, k]));
  const labels = cards.filter((x) => picked.includes(x.id)).map((x) => x.label);
  return (
    <div className="mt-2.5" aria-label={c.question}>
      <div className="grid grid-cols-2 gap-2">
        {cards.map((k) => {
          const on = picked.includes(k.id);
          return (
            <button key={k.id} disabled={!active} aria-pressed={on} onClick={() => toggle(k.id)}
              className={`text-left rounded-xl border-2 bg-white overflow-hidden transition-colors ${on ? "border-brand" : "border-line"} disabled:opacity-60`}>
              <span className="relative block aspect-[4/3] bg-[#F5F4F5]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {k.image && <img src={img(k.image, 300)} alt="" className="w-full h-full object-cover" />}
                <span aria-hidden className={`absolute top-1.5 right-1.5 w-6 h-6 rounded-full grid place-items-center text-[13px] font-bold ${on ? "bg-brand text-white" : "bg-white/90 border border-[#c9c9cf] text-transparent"}`}>✓</span>
              </span>
              <span className="block px-2.5 pt-2 pb-2.5">
                <span className="block text-[13px] font-semibold leading-tight">{k.label}</span>
                <span className="block text-[11px] text-muted leading-snug mt-0.5">{k.hint}</span>
                <span className="block text-[11px] text-[#444] mt-1">
                  {k.count} in catalogue · from {inr(k.from!)}
                  {brief.budget !== null && <><br />{k.inBudget ? `${k.inBudget} within ${inr(brief.budget)}` : `none within ${inr(brief.budget)}`}</>}
                </span>
              </span>
            </button>
          );
        })}
      </div>
      {active && (
        <div className="flex flex-wrap gap-2 mt-2.5">
          <button disabled={!picked.length} onClick={() => onAnswer(labels.join(" + "))}
            className="rounded-full bg-brand text-white text-[14px] font-semibold px-4 min-h-[40px] disabled:bg-[#b9bce0]">
            Continue{picked.length ? ` (${picked.length})` : ""}
          </button>
          <button onClick={() => onAnswer(HELP)} className="border border-brand text-brand rounded-full px-3.5 min-h-[40px] text-[14px]">{HELP}</button>
          <button onClick={() => onAnswer(c.noneLabel)} className="border border-brand text-brand rounded-full px-3.5 min-h-[40px] text-[14px]">{c.noneLabel}</button>
        </div>
      )}
    </div>
  );
}
