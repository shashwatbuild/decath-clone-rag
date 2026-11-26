import { Suspense } from "react";
import GearLab from "@/components/lab/GearLab";
export default function LabPage() {
  return <Suspense fallback={<main className="p-8 text-muted">Opening your Gear Lab…</main>}><GearLab /></Suspense>;
}
