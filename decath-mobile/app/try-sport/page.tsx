import { Suspense } from "react";
import TrySport from "@/components/experiences/TrySport";
export default function TrySportPage() {
  return (
    <Suspense
      fallback={<main className="p-8">Preparing your first session…</main>}
    >
      <TrySport />
    </Suspense>
  );
}
