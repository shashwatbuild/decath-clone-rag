import { notFound } from "next/navigation";
import { aspectScores, boughtTogether, demoReviews, getProduct, products, ratingBreakdown, similarProducts, toCard } from "@/lib/products";
import ProductView from "@/components/ProductView";

export function generateStaticParams() {
  return products.map((p) => ({ id: p.id }));
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const p = getProduct((await params).id);
  return { title: p ? `${p.brand} ${p.name}` : "Product" };
}

export default async function ProductPage({ params }: { params: Promise<{ id: string }> }) {
  const p = getProduct((await params).id);
  if (!p) notFound();
  return (
    <ProductView
      p={p}
      fbt={boughtTogether(p).map(toCard)}
      similar={similarProducts(p).map(toCard)}
      breakdown={ratingBreakdown(p)}
      reviews={demoReviews(p)}
      aspects={aspectScores(p)}
    />
  );
}
