import { notFound } from "next/navigation";
import { CATEGORIES, SHOP_LINKS, categoryBySlug, itemsForLink, products, productsInCategory, shopLinkBySlug } from "@/lib/products";
import ListingView from "@/components/ListingView";

export function generateStaticParams() {
  return [...new Set([...CATEGORIES.map((c) => c.slug), ...SHOP_LINKS.map((l) => l.slug)])].map((slug) => ({ slug })).concat({ slug: "all" });
}

export default async function CategoryPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (slug === "all") return <ListingView title="All Products" items={products} />;
  const link = shopLinkBySlug(slug);
  if (link?.sport) return <ListingView title={link.name} items={itemsForLink(link)} />;
  const cat = categoryBySlug(slug);
  if (!cat) notFound();
  return <ListingView title={cat.name} items={productsInCategory(cat.name)} />;
}
