import { cn } from "@/lib/utils";
import type { AwarenessMetric, HookCandidate, HookFitMetrics, SourceLink } from "@/types/workflow";

function AwarenessDisplay({ metric }: { metric: AwarenessMetric }) {
  const timingColor =
    metric.timing === "지금 올리기 좋음"
      ? "text-mint"
      : metric.timing === "타이밍 아님"
        ? "text-rose"
        : "text-sand";

  return (
    <div>
      <div className="mb-2 flex items-center gap-2">
        <div className="flex gap-[3px]">
          {[1, 2, 3, 4, 5].map((i) => (
            <span
              key={i}
              className={cn("text-[10px]", i <= metric.level ? "text-bronze" : "text-white/20")}
            >
              ●
            </span>
          ))}
        </div>
        <span className="text-xs font-semibold text-cream">{metric.level}/5</span>
      </div>
      <div className="space-y-[5px]">
        {[
          { label: "멜론", value: metric.melon },
          { label: "유튜브", value: metric.youtube },
          { label: "네이버", value: metric.naver },
        ].map(({ label, value }) => (
          <div key={label} className="flex gap-3 text-xs">
            <span className="w-10 shrink-0 text-sand/50">{label}</span>
            <span className="text-cream/70">{value}</span>
          </div>
        ))}
        <div className="flex gap-3 text-xs">
          <span className="w-10 shrink-0 text-sand/50">타이밍</span>
          <span className={cn("font-medium", timingColor)}>{metric.timing}</span>
        </div>
      </div>
    </div>
  );
}

function hookBucketMeta(bucket: HookFitMetrics["hookBucket"]) {
  switch (bucket) {
    case "sweet_spot":
      return {
        label: "스위트 스팟",
        description: "인지도 3~4 구간이라 훅 곡으로 쓰기 좋습니다.",
        className: "border-mint/30 bg-mint/10 text-mint",
      };
    case "too_famous":
      return {
        label: "너무 유명",
        description: "메인 곡으로 느껴질 가능성이 높아 입구 곡 역할은 약합니다.",
        className: "border-rose/30 bg-rose/10 text-rose",
      };
    default:
      return {
        label: "너무 마이너",
        description: "입구 곡으로 쓰기엔 국내 체감 인지도가 아직 약합니다.",
        className: "border-amber/30 bg-amber/10 text-amber",
      };
  }
}

function ScoreDisplay({ hookFit }: { hookFit: HookFitMetrics }) {
  const bucket = hookBucketMeta(hookFit.hookBucket);

  return (
    <div className="space-y-3 rounded-2xl border border-white/10 bg-black/15 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-sand/60">훅 곡 판정</p>
          <p className="mt-2 text-sm text-cream/70">{bucket.description}</p>
        </div>
        <span className={cn("rounded-full border px-3 py-1 text-xs font-semibold", bucket.className)}>
          {bucket.label}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3 text-xs sm:grid-cols-4">
        {[
          { label: "훅 적합도", value: `${hookFit.hookFitScore}점` },
          { label: "인지도", value: `${hookFit.awarenessScore}점` },
          { label: "현재성", value: `${hookFit.momentumScore}점` },
          { label: "과포화", value: `${hookFit.oversaturationScore}점` },
        ].map((item) => (
          <div key={item.label} className="rounded-2xl border border-white/10 bg-white/[0.04] p-3">
            <p className="text-[11px] uppercase tracking-[0.12em] text-sand/55">{item.label}</p>
            <p className="mt-2 text-sm font-semibold text-cream">{item.value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function SourceLinks({ title, sources }: { title: string; sources: SourceLink[] }) {
  if (sources.length === 0) {
    return null;
  }

  return (
    <details className="rounded-2xl border border-white/10 bg-black/15 p-4">
      <summary className="cursor-pointer text-sm font-medium text-cream">{title}</summary>
      <div className="mt-3 space-y-3">
        {sources.map((source) => (
          <a
            key={`${source.url}-${source.title}`}
            href={source.url}
            target="_blank"
            rel="noreferrer"
            className="block rounded-2xl border border-white/10 bg-white/[0.04] p-3"
          >
            <p className="text-sm font-medium text-cream">{source.title}</p>
            {source.snippet ? <p className="mt-2 text-xs leading-5 text-cream/60">{source.snippet}</p> : null}
            <p className="mt-2 break-all text-[11px] text-cream/45">{source.url}</p>
          </a>
        ))}
      </div>
    </details>
  );
}

interface HookCandidateCardProps {
  candidate: HookCandidate;
  selected: boolean;
  disabled?: boolean;
  onSelect: (candidateId: string) => void;
}

export function HookCandidateCard({
  candidate,
  selected,
  disabled = false,
  onSelect,
}: HookCandidateCardProps) {
  return (
    <div
      className={cn(
        "rounded-[28px] border p-5 transition",
        selected
          ? "border-bronze bg-bronze/12 shadow-panel"
          : "border-white/10 bg-white/[0.04] hover:border-white/20 hover:bg-white/[0.06]",
        disabled && "opacity-80",
      )}
    >
      <button
        type="button"
        onClick={() => onSelect(candidate.id)}
        disabled={disabled}
        className="w-full text-left"
      >
        <div className="mb-4">
          <p className="text-xs uppercase tracking-[0.2em] text-sand/70">Hook #{candidate.displayOrder}</p>
          <h3 className="mt-2 text-lg font-semibold text-cream">{candidate.trackName}</h3>
          <p className="mt-1 text-sm text-cream/70">{candidate.artistName}</p>
        </div>

        <div className="space-y-4">
          {candidate.hookFit ? <ScoreDisplay hookFit={candidate.hookFit} /> : null}

          <div>
            <p className="mb-1 text-xs font-semibold uppercase tracking-[0.18em] text-sand/60">사운드 개념</p>
            <p className="text-sm leading-6 text-cream/86">{candidate.soundConcept}</p>
          </div>

          <div>
            <p className="mb-1 text-xs font-semibold uppercase tracking-[0.18em] text-sand/60">연결 이유</p>
            <p className="text-sm leading-6 text-cream/74">{candidate.connectionReason}</p>
          </div>

          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-sand/60">인지도 지표</p>
            <AwarenessDisplay metric={candidate.awarenessMetric} />
          </div>

        </div>
      </button>

      <div className="mt-4 space-y-3">
        <SourceLinks title="리서치 출처 보기" sources={candidate.researchSources} />

        <button
          type="button"
          onClick={() => onSelect(candidate.id)}
          disabled={disabled}
          className={cn(
            "w-full rounded-2xl px-4 py-3 text-sm font-semibold transition",
            selected
              ? "bg-bronze text-white"
              : "border border-white/10 bg-white/[0.04] text-cream hover:bg-white/[0.08]",
            disabled && "cursor-not-allowed opacity-70",
          )}
        >
          {selected ? "선택됨" : "이 후보 선택"}
        </button>
      </div>
    </div>
  );
}
