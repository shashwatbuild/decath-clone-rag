import Link from "next/link";
import { SHOP_LINKS, img, itemsForLink, products, toCard } from "@/lib/products";
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

      <div className="px-4 pt-3 lg:hidden">
        <Link href="/search" className="flex items-center gap-3 border border-line rounded-full px-4 py-3 text-[#757575]">
          <IconSearch className="w-5 h-5" /> Search for 60+ sports and 6000+ products
        </Link>
      </div>

      <div className="flex gap-4 overflow-x-auto no-scrollbar px-4 pt-5 lg:grid lg:grid-cols-8 lg:gap-4 lg:overflow-visible lg:pt-8">
        {SHOP_LINKS.map((c) => {
          const p = itemsForLink(c)[0];
          return (
            <Link key={c.slug} href={`/c/${c.slug}`} className="flex flex-col items-center gap-1.5 shrink-0 w-[72px] lg:w-auto">
              <span className="w-[68px] h-[68px] lg:w-[112px] lg:h-[112px] rounded-full bg-[#F5F4F5] overflow-hidden ring-1 ring-line">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={img(p.images[0], 160)} alt="" className="w-full h-full object-cover mix-blend-multiply" />
              </span>
              <span className="text-[12px] lg:text-[15px] text-center leading-tight">{c.name}</span>
            </Link>
          );
        })}
      </div>

      <div className="mt-5 lg:px-4"><CouponBanner /></div>

      <div className="lg:grid lg:grid-cols-[2fr_1fr] lg:gap-4 lg:px-4 lg:items-stretch">
      <div className="mx-4 mt-5 lg:mx-0 rounded-2xl bg-brand text-white p-5 lg:p-8 relative overflow-hidden">
        <p className="text-xs uppercase tracking-widest opacity-80">Ask our assistant</p>
        <p className="text-xl font-semibold mt-1 leading-snug">Not sure what to buy?<br />Chat with our sports expert.</p>
        <Link href="/chat" className="inline-block mt-4 bg-white text-brand font-semibold rounded-full px-5 py-2 text-sm">Start chatting</Link>
        <div className="absolute -right-8 -bottom-10 w-40 h-40 rounded-full bg-white/10" />
      </div>

      <Link href="/plan" className="mx-4 mt-3 lg:mx-0 lg:mt-5 flex items-center justify-between rounded-2xl border border-line p-4">
        <span>
          <span className="block text-xs uppercase tracking-widest text-muted">New</span>
          <span className="block font-semibold mt-0.5">Plan your training gear</span>
          <span className="block text-sm text-muted">A week-by-week timeline within your budget</span>
        </span>
        <span aria-hidden className="text-2xl text-brand">›</span>
      </Link>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mx-4 mt-3 lg:mt-4">
        {[
          { name: "Badminton kit", body: "Racket, shuttles, shoes, bag and grips", q: "Help me build a badminton kit" },
          { name: "Marathon kit", body: "Shoes, shorts, socks, hydration and a watch", q: "Help me build a marathon kit" },
        ].map((k) => (
          <Link key={k.name} href={`/chat?q=${encodeURIComponent(k.q)}`} className="flex items-center justify-between rounded-2xl bg-[#F0F8F4] p-4">
            <span>
              <span className="block text-xs uppercase tracking-widest text-[#0b7a4f]">Guided kit</span>
              <span className="block font-semibold mt-0.5">{k.name}</span>
              <span className="block text-sm text-muted">{k.body}</span>
            </span>
            <span aria-hidden className="text-2xl text-[#0b7a4f]">›</span>
          </Link>
        ))}
      </div>

      <SectionTitle>Bestsellers</SectionTitle>
      <Rail items={top.map(toCard)} />

      <SectionTitle>Biggest discounts</SectionTitle>
      <Rail items={deals.map(toCard)} />

      {SHOP_LINKS.slice(0, 3).map((c) => (
        <section key={c.slug}>
          <SectionTitle href={`/c/${c.slug}`}>{c.name}</SectionTitle>
          <Rail items={[...itemsForLink(c)].sort((a, b) => b.reviewCount - a.reviewCount).slice(0, 10).map(toCard)} />
        </section>
      ))}

      <ChatFab bottom="bottom-8" />
    </main>
  );
}

function Rail({ items }: { items: ReturnType<typeof toCard>[] }) {
  return (
    <div className="flex gap-2 overflow-x-auto no-scrollbar snap-x-mandatory lg:grid lg:grid-cols-6 lg:gap-px lg:overflow-visible lg:bg-line lg:mx-4 lg:border lg:border-line lg:[&>*:nth-child(n+7)]:hidden">
      {items.map((p) => (
        <div key={p.id} className="w-[46%] lg:w-auto shrink-0 snap-start border-r border-line last:border-r-0 lg:border-r-0">
          <ProductCard p={p} compact />
        </div>
      ))}
    </div>
  );
}
