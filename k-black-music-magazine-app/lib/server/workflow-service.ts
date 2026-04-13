import { extractConceptForWorkflow, findCandidatesForConcept } from "@/lib/ai/gemini";
import {
  getCachedConcept,
  getWorkflow,
  saveConceptAnalysis,
  saveResearchCandidates,
  updateWorkflowStatus,
} from "@/lib/server/workflow-store";

export async function runConceptExtraction(workflowId: string, externalContext?: string) {
  const workflow = await getWorkflow(workflowId);
  await updateWorkflowStatus(workflowId, "researching");

  const analysis = await extractConceptForWorkflow({
    workflowId,
    mainTrack: workflow.mainTrack,
    mainArtist: workflow.mainArtist,
    externalContext,
  });

  return saveConceptAnalysis(workflowId, analysis);
}

export async function runCandidateSearch(workflowId: string) {
  const workflow = await getWorkflow(workflowId);
  const analysis = workflow.mainTrackAnalysis ?? getCachedConcept(workflowId);

  if (!analysis) {
    throw new Error("개념 분석 결과가 없습니다. 먼저 리서치를 실행해 주세요.");
  }

  const candidates = await findCandidatesForConcept({
    workflowId,
    mainTrack: workflow.mainTrack,
    mainArtist: workflow.mainArtist,
    concept: analysis.concept,
    conceptExplanation: analysis.conceptExplanation,
  });

  return saveResearchCandidates(workflowId, candidates, analysis);
}
