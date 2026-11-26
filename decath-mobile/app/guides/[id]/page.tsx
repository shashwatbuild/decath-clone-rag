import Link from "next/link";
import { notFound } from "next/navigation";
import { KNOWLEDGE } from "@/lib/rag/knowledge";
import { products, toCard } from "@/lib/products";
import ProductCard from "@/components/ProductCard";
import { TopBar } from "@/components/ui";

export function generateStaticParams() {
  return KNOWLEDGE.map((k) => ({ id: k.id }));
}

/** The full text of a guide or policy that an assistant answer cited. */
export default async function GuidePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const doc = KNOWLEDGE.find((k) => k.id === id);
  if (!doc) notFound();
  const related = products
    .filter((p) => doc.categories?.includes(p.category) && p.inStock)
    .sort((a, b) => b.rating * Math.log10(b.reviewCount + 10) - a.rating * Math.log10(a.reviewCount + 10))
    .slice(0, 6);

  return (
    <main className="pb-12">
      <TopBar title={doc.title} />
      <article className="px-4 pt-4 lg:max-w-3xl">
        <p className="text-xs font-semibold text-muted">{doc.kind === "guide" ? "Buying guide" : "Store policy"}</p>
        <div className="mt-3 space-y-4 text-[16px] leading-relaxed">
          {doc.text.split(/\n\s*\n/).map((para, i) => <p key={i}>{para}</p>)}
        </div>
        <p className="mt-6 text-sm text-muted">
          {doc.kind === "guide" ? "General buying advice written for this store." : "How this demo store works."} Ask the{" "}
          <Link href="/chat" className="text-brand underline">assistant</Link> if you want it applied to your situation.
        </p>
      </article>
      {related.length > 0 && (
        <section className="mt-8">
          <h2 className="px-4 pb-3 text-[19px] font-semibold">Related products</h2>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-px bg-line border-y border-line lg:mx-4 lg:border">
            {related.map((p) => <ProductCard key={p.id} p={toCard(p)} />)}
          </div>
        </section>
      )}
    </main>
  );
}
