import { Suspense } from "react";
import FitMemory from "@/components/experiences/FitMemory";
export default function FitPage() {
  return (
    <Suspense
      fallback={<main className="p-8">Opening your fit wardrobe…</main>}
    >
      <FitMemory />
    </Suspense>
  );
}
