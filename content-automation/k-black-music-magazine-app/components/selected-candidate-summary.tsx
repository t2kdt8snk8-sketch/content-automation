import type { HookCandidate } from "@/types/workflow";

interface SelectedCandidateSummaryProps {
  candidate: HookCandidate;
}

export function SelectedCandidateSummary({ candidate }: SelectedCandidateSummaryProps) {
  return (
    <section className="rounded-[28px] border border-bronze/30 bg-bronze/10 p-5">
      <p className="text-xs uppercase tracking-[0.2em] text-sand/70">선택된 훅 곡</p>
      <h2 className="mt-2 text-xl font-semibold text-cream">{candidate.trackName}</h2>
      <p className="mt-1 text-sm text-cream/70">{candidate.artistName}</p>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl border border-white/10 bg-black/15 p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-sand/60">사운드 개념</p>
          <p className="mt-2 text-sm leading-6 text-cream/80">{candidate.soundConcept}</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-black/15 p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-sand/60">왜 이 곡인가</p>
          <p className="mt-2 text-sm leading-6 text-cream/80">{candidate.connectionReason}</p>
        </div>
      </div>

      {candidate.hookFit ? (
        <div className="mt-4 grid grid-cols-3 gap-3">
          <div className="rounded-2xl border border-white/10 bg-black/15 p-4">
            <p className="text-[11px] uppercase tracking-[0.12em] text-sand/55">인지도</p>
            <p className="mt-2 text-sm font-semibold text-cream">{candidate.hookFit.awarenessTier}/5</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-black/15 p-4">
            <p className="text-[11px] uppercase tracking-[0.12em] text-sand/55">훅 적합도</p>
            <p className="mt-2 text-sm font-semibold text-cream">{candidate.hookFit.hookFitScore}점</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-black/15 p-4">
            <p className="text-[11px] uppercase tracking-[0.12em] text-sand/55">타이밍</p>
            <p className="mt-2 text-sm font-semibold text-cream">{candidate.awarenessMetric.timing}</p>
          </div>
        </div>
      ) : null}
    </section>
  );
}
