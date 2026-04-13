import { HookCandidateCard } from "@/components/hook-candidate-card";
import type { HookCandidate } from "@/types/workflow";

interface HookCandidateListProps {
  candidates: HookCandidate[];
  selectedCandidateId: string | null;
  disabled?: boolean;
  onSelect: (candidateId: string) => void;
}

export function HookCandidateList({
  candidates,
  selectedCandidateId,
  disabled = false,
  onSelect,
}: HookCandidateListProps) {
  return (
    <div className="space-y-4">
      {candidates.map((candidate) => (
        <HookCandidateCard
          key={candidate.id}
          candidate={candidate}
          selected={selectedCandidateId === candidate.id}
          disabled={disabled}
          onSelect={onSelect}
        />
      ))}
    </div>
  );
}
