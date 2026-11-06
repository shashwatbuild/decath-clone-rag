import { notFound } from "next/navigation";
import { CATEGORIES, categoryBySlug, products, productsInCategory } from "@/lib/products";
import ListingView from "@/components/ListingView";

export function generateStaticParams() {
  return [...CATEGORIES.map((c) => ({ slug: c.slug })), { slug: "all" }];
}

export default async function CategoryPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (slug === "all") return <ListingView title="All Products" items={products} />;
  const cat = categoryBySlug(slug);
  if (!cat) notFound();
  return <ListingView title={cat.name} items={productsInCategory(cat.name)} />;
}
