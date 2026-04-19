import { cn } from "@/lib/utils";
import type { WorkflowStatus } from "@/types/workflow";

const steps: Array<{ key: string; label: string; description: string }> = [
  { key: "input", label: "입력", description: "메인 곡 입력" },
  { key: "research", label: "리서치", description: "Gemini 후보 탐색" },
  { key: "select", label: "선택", description: "최종 훅 곡 선택" },
];

function getCurrentStep(status: WorkflowStatus | "idle") {
  switch (status) {
    case "draft":
    case "idle":
      return 1;
    case "researching":
    case "researched":
      return 2;
    case "selected":
      return 3;
    case "failed":
      return 2;
    default:
      return 1;
  }
}

export function WorkflowStepper({ status }: { status: WorkflowStatus | "idle" }) {
  const currentStep = getCurrentStep(status);

  return (
    <div className="rounded-[28px] border border-white/10 bg-white/5 p-4 backdrop-blur-sm">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-sand/80">Workflow</p>
        <p className="text-xs text-cream/60">모바일 퍼스트</p>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {steps.map((step, index) => {
          const active = currentStep === index + 1;
          const done = currentStep > index + 1;

          return (
            <div
              key={step.key}
              className={cn(
                "rounded-2xl border p-3 transition-colors",
                done && "border-mint/50 bg-mint/10",
                active && "border-bronze bg-bronze/15",
                !active && !done && "border-white/10 bg-black/10",
              )}
            >
              <p
                className={cn(
                  "mb-2 text-xs font-semibold",
                  done && "text-mint",
                  active && "text-sand",
                  !active && !done && "text-cream/55",
                )}
              >
                {index + 1}
              </p>
              <p className="text-sm font-semibold text-cream">{step.label}</p>
              <p className="mt-1 text-[11px] leading-4 text-cream/60">{step.description}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
