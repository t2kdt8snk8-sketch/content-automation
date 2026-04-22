"use client";

import { useState } from "react";
import type { CopyDraft, TrackDetail } from "@/types/workflow";
import { ErrorState } from "@/components/error-state";

function TrackDetailCard({ track }: { track: TrackDetail }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.04]">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="flex w-full items-center justify-between px-4 py-3 text-left"
      >
        <div>
          <p className="text-sm font-semibold text-cream">{track.trackName}</p>
          <p className="text-xs text-sand/60">{track.artistName}</p>
        </div>
        <span className="ml-4 shrink-0 text-xs text-sand/50">{open ? "접기 ▲" : "펼치기 ▼"}</span>
      </button>
      {open ? (
        <div className="border-t border-white/10 px-4 pb-4 pt-3 space-y-3">
          {(["감상 원재료", "사운드/맥락 팩트", "흥미 TMI"] as const).map((category) => {
            const items = track.items.filter((item) => item.category === category);
            if (items.length === 0) return null;
            return (
              <div key={category}>
                <p className="mb-2 text-[11px] uppercase tracking-[0.12em] text-sand/50">{category}</p>
                <ul className="space-y-2">
                  {items.map((item, i) => (
                    <li key={i} className="text-sm leading-6 text-cream/74">
                      {item.content}
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

interface CopyWorkflowPanelProps {
  workflowId?: string;
  selectedTrackLabel?: string;
  trackDetails: TrackDetail[] | null;
  copyDraft: CopyDraft | null;
  detailing: boolean;
  generating: boolean;
  onDetail: () => Promise<void>;
  onGenerate: () => Promise<void>;
}

export function CopyWorkflowPanel({
  workflowId,
  selectedTrackLabel,
  trackDetails,
  copyDraft,
  detailing,
  generating,
  onDetail,
  onGenerate,
}: CopyWorkflowPanelProps) {
  const [figmaCopied, setFigmaCopied] = useState(false);

  function copyFigmaId() {
    if (!workflowId) return;
    void navigator.clipboard.writeText(workflowId).then(() => {
      setFigmaCopied(true);
      setTimeout(() => setFigmaCopied(false), 2000);
    });
  }

  return (
    <section className="space-y-4">
      <div className="px-1">
        <p className="text-xs uppercase tracking-[0.2em] text-sand/70">Step 5-6</p>
        <h2 className="mt-2 text-xl font-semibold text-cream">카피 생성</h2>
        <p className="mt-2 text-sm leading-6 text-cream/65">
          선택된 훅 곡을 바탕으로 슬라이드 카피 초안을 만듭니다.
        </p>
      </div>

      {/* Step A: 곡 정보 리서치 */}
      <div className="rounded-[28px] border border-white/10 bg-black/20 p-5">
        <p className="mb-4 text-sm font-semibold text-cream">
          {selectedTrackLabel ? `선택된 훅 곡: ${selectedTrackLabel}` : "먼저 훅 곡을 선택해 주세요."}
        </p>
        <button
          type="button"
          disabled={!selectedTrackLabel || detailing || generating}
          onClick={() => void onDetail()}
          className="w-full rounded-2xl bg-bronze px-4 py-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-bronze/40"
        >
          {detailing ? "곡 정보 리서치 중..." : trackDetails ? "곡 정보 다시 리서치" : "Gemini 곡 정보 리서치"}
        </button>
      </div>

      {/* 리서치 결과 */}
      {trackDetails && trackDetails.length > 0 ? (
        <div className="rounded-[28px] border border-white/10 bg-black/20 p-5 space-y-3">
          <p className="text-sm font-semibold text-cream">곡 정보 리서치 결과</p>
          {trackDetails.map((track) => (
            <TrackDetailCard key={`${track.trackName}-${track.artistName}`} track={track} />
          ))}
        </div>
      ) : null}

      {/* Step B: 카피 생성 */}
      <div className="rounded-[28px] border border-white/10 bg-black/20 p-5 space-y-4">
        {copyDraft ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
              <p className="text-[11px] uppercase tracking-[0.12em] text-sand/55">캡션 앵글</p>
              <p className="mt-2 text-sm text-cream/80">{copyDraft.captionAngle}</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
              <p className="text-[11px] uppercase tracking-[0.12em] text-sand/55">선택 근거</p>
              <p className="mt-2 text-sm text-cream/80">{copyDraft.captionReason}</p>
            </div>
          </div>
        ) : null}
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            disabled={!selectedTrackLabel || detailing || generating}
            onClick={() => void onGenerate()}
            className="rounded-2xl bg-bronze px-4 py-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-bronze/40"
          >
            {generating ? "카피 생성 중..." : "Claude 카피 생성"}
          </button>
          <button
            type="button"
            disabled={!copyDraft || !workflowId}
            onClick={copyFigmaId}
            className="rounded-2xl bg-cream px-4 py-4 text-sm font-semibold text-ink disabled:cursor-not-allowed disabled:bg-white/20 disabled:text-cream/40"
          >
            {figmaCopied ? "복사됨 ✓" : "Figma ID 복사"}
          </button>
        </div>
      </div>

    </section>
  );
}
