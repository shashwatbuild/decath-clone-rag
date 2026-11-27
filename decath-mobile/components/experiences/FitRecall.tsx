"use client";
import Link from "next/link";
import { fitEligible, fitInsight } from "@/lib/experiences/model";
import { useExperiences } from "@/lib/experiences/store";
export default function FitRecall({
  productId,
  onPick,
}: {
  productId: string;
  onPick?: (size: string) => void;
}) {
  const { data } = useExperiences();
  if (!fitEligible(productId)) return null;
  const insight = fitInsight(productId, data.fits);
  return (
    <div className="fit-recall">
      <div>
        <span className="experience-label">Your fit memory</span>
        <p>{insight.message}</p>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        {insight.size && onPick && (
          <button className="lab-button" onClick={() => onPick(insight.size!)}>
            Use my remembered size {insight.size}
          </button>
        )}
        <Link
          href={`/fit?product=${productId}`}
          className="experience-text-button"
        >
          {insight.record ? "Review my fit memory" : "Remember how this fits"} →
        </Link>
      </div>
    </div>
  );
}
