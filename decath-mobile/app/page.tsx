import Link from "next/link";
import { CATEGORIES, img, products, productsInCategory, toCard } from "@/lib/products";
import ProductCard from "@/components/ProductCard";
import { ChatFab, SectionTitle, TopBar } from "@/components/ui";
import { CouponBanner } from "@/components/CouponBanner";
import { IconSearch } from "@/components/Icons";

export default function Home() {
  const top = [...products].sort((a, b) => b.reviewCount - a.reviewCount).slice(0, 6);
  const deals = [...products].sort((a, b) => (b.mrp - b.price) / b.mrp - (a.mrp - a.price) / a.mrp).slice(0, 6);

  return (
    <main className="pb-10">
      <TopBar back={false} logo />

      <div className="px-4 pt-3">
        <Link href="/search" className="flex items-center gap-3 border border-line rounded-full px-4 py-3 text-[#757575]">
          <IconSearch className="w-5 h-5" /> Search for 60+ sports and 6000+ products
        </Link>
      </div>

      <div className="flex gap-4 overflow-x-auto no-scrollbar px-4 pt-5">
        {CATEGORIES.map((c) => {
          const p = productsInCategory(c.name)[0];
          return (
            <Link key={c.slug} href={`/c/${c.slug}`} className="flex flex-col items-center gap-1.5 shrink-0 w-[72px]">
              <span className="w-[68px] h-[68px] rounded-full bg-[#F5F4F5] overflow-hidden ring-1 ring-line">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={img(p.images[0], 160)} alt="" className="w-full h-full object-cover mix-blend-multiply" />
              </span>
              <span className="text-[12px] text-center leading-tight">{c.name}</span>
            </Link>
          );
        })}
      </div>

      <div className="mt-5"><CouponBanner /></div>

      <div className="mx-4 mt-5 rounded-2xl bg-brand text-white p-5 relative overflow-hidden">
        <p className="text-xs uppercase tracking-widest opacity-80">Ask our assistant</p>
        <p className="text-xl font-semibold mt-1 leading-snug">Not sure what to buy?<br />Chat with our sports expert.</p>
        <Link href="/chat" className="inline-block mt-4 bg-white text-brand font-semibold rounded-full px-5 py-2 text-sm">Start chatting</Link>
        <div className="absolute -right-8 -bottom-10 w-40 h-40 rounded-full bg-white/10" />
      </div>

      <SectionTitle>Bestsellers</SectionTitle>
      <Rail items={top.map(toCard)} />

      <SectionTitle>Biggest discounts</SectionTitle>
      <Rail items={deals.map(toCard)} />

      {CATEGORIES.slice(0, 3).map((c) => (
        <section key={c.slug}>
          <SectionTitle href={`/c/${c.slug}`}>{c.name}</SectionTitle>
          <Rail items={productsInCategory(c.name).map(toCard)} />
        </section>
      ))}

      <ChatFab bottom="bottom-8" />
    </main>
  );
}

function Rail({ items }: { items: ReturnType<typeof toCard>[] }) {
  return (
    <div className="flex gap-2 overflow-x-auto no-scrollbar snap-x-mandatory">
      {items.map((p) => (
        <div key={p.id} className="w-[46%] shrink-0 snap-start border-r border-line last:border-r-0">
          <ProductCard p={p} compact />
        </div>
      ))}
    </div>
  );
}
