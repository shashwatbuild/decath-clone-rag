import { Suspense } from "react";
import AdventurePlanner from "@/components/experiences/AdventurePlanner";
export default function AdventurePage() {
  return (
    <Suspense
      fallback={<main className="p-8">Preparing your adventure planner…</main>}
    >
      <AdventurePlanner />
    </Suspense>
  );
}
