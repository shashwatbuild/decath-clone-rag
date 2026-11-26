import { Suspense } from "react";
import LivePreview from "@/components/tryon/LivePreview";
export default function TryOnPage() { return <Suspense fallback={<main className="p-8">Preparing the outfit preview…</main>}><LivePreview /></Suspense>; }
