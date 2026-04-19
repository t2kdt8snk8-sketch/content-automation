import type { MainTrackAnalysis } from "@/types/workflow";

export function ConceptCard({ analysis }: { analysis: MainTrackAnalysis }) {
  return (
    <div className="rounded-[28px] border border-bronze/30 bg-bronze/8 p-5">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-sand/70">이번 매거진 개념</p>
        {analysis.conceptSource === "web" ? (
          <span className="rounded-full border border-mint/30 bg-mint/10 px-2 py-0.5 text-[10px] font-medium text-mint">
            웹 출처
          </span>
        ) : (
          <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] font-medium text-cream/40">
            AI 추론
          </span>
        )}
      </div>
      <p className="text-xl font-semibold text-cream">{analysis.concept}</p>
      <p className="mt-2 text-sm leading-6 text-cream/68">{analysis.conceptExplanation}</p>
    </div>
  );
}
