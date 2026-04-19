interface SelectionBarProps {
  selectedTrackLabel?: string;
  disabled?: boolean;
  onConfirm: () => Promise<void>;
}

export function SelectionBar({ selectedTrackLabel, disabled = false, onConfirm }: SelectionBarProps) {
  return (
    <div className="sticky bottom-4 z-20 rounded-[28px] border border-white/10 bg-ink/90 p-4 shadow-panel backdrop-blur-md">
      <div className="mb-4">
        <p className="text-xs uppercase tracking-[0.18em] text-sand/65">선택 상태</p>
        <p className="mt-2 text-sm text-cream/75">
          {selectedTrackLabel ? `${selectedTrackLabel} 선택 완료 직전` : "카드를 하나 선택하면 다음 단계 준비가 끝납니다."}
        </p>
      </div>
      <button
        type="button"
        disabled={!selectedTrackLabel || disabled}
        onClick={() => void onConfirm()}
        className="w-full rounded-2xl bg-cream px-4 py-4 text-sm font-semibold text-ink transition hover:bg-[#fff7eb] disabled:cursor-not-allowed disabled:bg-white/20 disabled:text-cream/40"
      >
        {disabled ? "저장 중..." : "이 후보로 선택 확정"}
      </button>
    </div>
  );
}
