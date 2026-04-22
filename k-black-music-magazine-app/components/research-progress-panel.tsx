import type { WorkflowStatus } from "@/types/workflow";

function getStatusCopy(status: WorkflowStatus | "idle") {
  switch (status) {
    case "idle":
      return {
        title: "입력 대기 중",
        body: "메인 곡과 아티스트를 입력하면 훅 곡 후보 5개를 리서치합니다.",
      };
    case "draft":
      return {
        title: "작업 세션 생성 완료",
        body: "이제 리서치와 검증을 순차적으로 실행합니다.",
      };
    case "researching":
      return {
        title: "리서치 중",
        body: "메인 곡의 사운드 기법을 분석하고 훅 곡 후보를 탐색하고 있습니다.",
      };
    case "researched":
      return {
        title: "리서치 완료",
        body: "후보 5개를 확보했습니다. 카드 중 하나를 선택해 주세요.",
      };
    case "selected":
      return {
        title: "선택 완료",
        body: "최종 훅 곡 선택이 저장되었습니다.",
      };
    case "failed":
      return {
        title: "일시 오류",
        body: "외부 API나 저장 과정에서 오류가 발생했습니다. 다시 시도해 주세요.",
      };
    default:
      return {
        title: "진행 중",
        body: "",
      };
  }
}

export function ResearchProgressPanel({
  status,
  isBusy,
}: {
  status: WorkflowStatus | "idle";
  isBusy: boolean;
}) {
  const copy = getStatusCopy(status);

  return (
    <div className="rounded-[28px] border border-white/10 bg-black/20 p-5">
      <div className="flex items-start gap-4">
        <div className="mt-1 flex h-10 w-10 items-center justify-center rounded-full border border-bronze/30 bg-bronze/10">
          {isBusy ? (
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-sand/30 border-t-sand" />
          ) : (
            <div className="h-2.5 w-2.5 rounded-full bg-sand" />
          )}
        </div>
        <div className="space-y-2">
          <p className="text-sm font-semibold text-cream">{copy.title}</p>
          <p className="text-sm leading-6 text-cream/65">{copy.body}</p>
        </div>
      </div>
    </div>
  );
}
