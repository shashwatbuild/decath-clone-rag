"use client";

import Link from "next/link";
import { getProduct, inr } from "@/lib/products";
import { useWatches } from "@/lib/watch";
import { TopBar } from "@/components/ui";

const NOTES = [
  { title: "Save ₹100 on your first order", body: "Use code NC100 on orders above ₹1,499.", href: "/c/all", when: "Today" },
  { title: "Price drop on footballs ⚽", body: "Training balls now from ₹599.", href: "/c/footballs", when: "Today" },
  { title: "New arrivals in running", body: "Kiprun Kipride Max is here: max cushioning for long runs.", href: "/p/8960547", when: "Yesterday" },
  { title: "Not sure what to buy?", body: "Ask our chat assistant to compare products for you.", href: "/chat?q=" + encodeURIComponent("Compare 2 yoga mats for beginners"), when: "2 days ago" },
];

export default function NotificationsPage() {
  const { list, unwatch } = useWatches();
  const watched = list.map((w) => ({ w, p: getProduct(w.id) })).filter((x) => x.p);

  return (
    <main className="pb-10">
      <TopBar title="Notifications" />

      {watched.length > 0 && (
        <section className="border-b-8 border-[#F5F4F5] lg:max-w-3xl">
          <h2 className="px-4 pt-4 pb-1 text-[13px] text-muted">Price watch</h2>
          <ul className="divide-y divide-line">
            {watched.map(({ w, p }) => {
              const hit = p!.price <= w.target;
              return (
                <li key={w.id} className="flex gap-3 px-4 py-4 items-start">
                  <span className={`mt-1.5 w-2.5 h-2.5 rounded-full shrink-0 ${hit ? "bg-[#3d9a6d]" : "bg-[#c9c9c9]"}`} />
                  <Link href={`/p/${w.id}`} className="flex-1 min-w-0">
                    <span className="block font-semibold text-[15px] line-clamp-1">{p!.shortName}</span>
                    <span className="block text-[14px] mt-0.5">
                      {hit ? <b className="text-[#3d9a6d]">Alert price reached</b> : "Waiting for a drop"} · now {inr(p!.price)}
                    </span>
                    <span className="block text-[13px] text-muted">Alert at {inr(w.target)} · was {inr(w.priceThen)} when you started watching</span>
                  </Link>
                  <button onClick={() => unwatch(w.id)} className="text-sm text-brand underline shrink-0">Stop</button>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <ul className="divide-y divide-line lg:max-w-3xl">
        {NOTES.map((n) => (
          <li key={n.title}>
            <Link href={n.href} className="flex gap-3 px-4 py-4">
              <span className="mt-1.5 w-2.5 h-2.5 rounded-full bg-brand shrink-0" />
              <span className="flex-1">
                <span className="block font-semibold text-[15px]">{n.title}</span>
                <span className="block text-[14px] text-muted mt-0.5">{n.body}</span>
                <span className="block text-[12px] text-[#9a9a9a] mt-1.5">{n.when}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
