export function EmptyState() {
  return (
    <div className="rounded-[28px] border border-dashed border-white/15 bg-black/10 p-8 text-center">
      <p className="text-sm font-medium text-cream">아직 후보가 없습니다.</p>
      <p className="mt-2 text-sm leading-6 text-cream/60">
        메인 곡과 아티스트를 입력하면 리서치 결과 카드 5개가 여기에 표시됩니다.
      </p>
    </div>
  );
}
