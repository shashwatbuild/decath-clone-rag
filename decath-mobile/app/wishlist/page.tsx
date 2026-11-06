"use client";

import Link from "next/link";
import { getProduct, toCard } from "@/lib/products";
import { useStore } from "@/lib/store";
import ProductCard from "@/components/ProductCard";
import { TopBar } from "@/components/ui";

export default function WishlistPage() {
  const { wishlist } = useStore();
  const items = wishlist.map(getProduct).filter(Boolean).map((p) => toCard(p!));
  return (
    <main className="pb-10">
      <TopBar title={`Wishlist (${items.length})`} />
      {items.length ? (
        <div className="grid grid-cols-2 gap-px bg-line border-y border-line">
          {items.map((p) => <ProductCard key={p.id} p={p} />)}
        </div>
      ) : (
        <div className="px-8 py-24 text-center">
          <p className="text-xl font-semibold">Your wishlist is empty</p>
          <p className="text-muted mt-2">Tap the heart on any product to save it here.</p>
          <Link href="/" className="inline-block mt-6 bg-brand text-white rounded-full px-8 py-3 font-semibold">Explore products</Link>
        </div>
      )}
    </main>
  );
}
