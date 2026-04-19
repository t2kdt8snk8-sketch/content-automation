import { deriveHookFitFromAwarenessMetric } from "@/lib/scoring/hook-fit";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { clearWorkflowDebug, getWorkflowDebug } from "@/lib/server/debug-store";
import { buildMockCandidates } from "@/lib/server/mock-data";
import type {
  HookCandidate,
  MainTrackAnalysis,
  SourceLink,
  Workflow,
  WorkflowInput,
  WorkflowStatus,
  AwarenessMetric,
  CopyDraft,
  TrackDetail,
  ConceptDetail,
} from "@/types/workflow";

type WorkflowRecord = {
  id: string;
  main_track: string;
  main_artist: string;
  status: WorkflowStatus;
  selected_candidate_id: string | null;
  main_track_analysis: MainTrackAnalysis | null;
  main_track_external_context: string | null;
  copy_draft: CopyDraft | null;
  track_details: TrackDetail[] | null;
  concept_detail: ConceptDetail | null;
  created_at: string;
  updated_at: string;
};

type CandidateRecord = {
  id: string;
  workflow_id: string;
  track_name: string;
  artist_name: string;
  sound_concept: string;
  connection_reason: string;
  awareness_metric: string;
  research_sources: SourceLink[];
  display_order: number;
  created_at: string;
};

const memoryStore = new Map<string, Workflow>();
const conceptCache = new Map<string, MainTrackAnalysis>();

function now() {
  return new Date().toISOString();
}

function withDerivedHookFit(candidate: Omit<HookCandidate, "hookFit"> & { hookFit?: HookCandidate["hookFit"] }) {
  return {
    ...candidate,
    hookFit: candidate.hookFit ?? deriveHookFitFromAwarenessMetric(candidate.awarenessMetric),
  };
}

function parseAwarenessMetric(value: string | AwarenessMetric): AwarenessMetric {
  if (typeof value !== "string") {
    return value;
  }

  try {
    return JSON.parse(value) as AwarenessMetric;
  } catch {
    return {
      level: 3,
      melon: value,
      youtube: "확인 불가",
      naver: "확인 불가",
      timing: "무난함",
    };
  }
}

function toWorkflow(workflow: WorkflowRecord, candidates: CandidateRecord[]): Workflow {
  return {
    id: workflow.id,
    mainTrack: workflow.main_track,
    mainArtist: workflow.main_artist,
    status: workflow.status,
    selectedCandidateId: workflow.selected_candidate_id,
    mainTrackAnalysis: workflow.main_track_analysis ?? undefined,
    mainTrackExternalContext: workflow.main_track_external_context ?? undefined,
    copyDraft: workflow.copy_draft ?? undefined,
    trackDetails: workflow.track_details ?? undefined,
    conceptDetail: workflow.concept_detail ?? undefined,
    createdAt: workflow.created_at,
    updatedAt: workflow.updated_at,
    candidates: candidates
      .sort((a, b) => a.display_order - b.display_order)
      .map((candidate) =>
        withDerivedHookFit({
          id: candidate.id,
          trackName: candidate.track_name,
          artistName: candidate.artist_name,
          soundConcept: candidate.sound_concept,
          connectionReason: candidate.connection_reason,
          awarenessMetric: parseAwarenessMetric(candidate.awareness_metric),
          researchSources: candidate.research_sources,
          displayOrder: candidate.display_order,
        }),
      ),
    debug: getWorkflowDebug(workflow.id),
  };
}

function cloneWorkflow(workflow: Workflow): Workflow {
  return structuredClone(workflow);
}

async function createMemoryWorkflow(input: WorkflowInput) {
  const timestamp = now();
  const workflow: Workflow = {
    id: crypto.randomUUID(),
    mainTrack: input.mainTrack,
    mainArtist: input.mainArtist,
    status: "draft",
    selectedCandidateId: null,
    candidates: [],
    debug: undefined,
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  clearWorkflowDebug(workflow.id);
  memoryStore.set(workflow.id, workflow);
  return cloneWorkflow(workflow);
}

function assertMemoryWorkflow(id: string) {
  const workflow = memoryStore.get(id);
  if (!workflow) {
    throw new Error("워크플로우를 찾을 수 없습니다.");
  }

  return workflow;
}

async function getMemoryWorkflow(id: string) {
  return cloneWorkflow(assertMemoryWorkflow(id));
}

async function patchMemoryWorkflow(id: string, patch: Partial<Workflow>) {
  const workflow = assertMemoryWorkflow(id);
  const nextWorkflow = {
    ...workflow,
    ...patch,
    updatedAt: now(),
  };

  memoryStore.set(id, nextWorkflow);
  return cloneWorkflow(nextWorkflow);
}

export async function createWorkflow(input: WorkflowInput) {
  const supabase = createSupabaseServerClient();

  if (!supabase) {
    return createMemoryWorkflow(input);
  }

  const { data, error } = await supabase
    .from("workflows")
    .insert({
      main_track: input.mainTrack,
      main_artist: input.mainArtist,
      status: "draft",
    })
    .select()
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "워크플로우 생성에 실패했습니다.");
  }

  return toWorkflow(data as WorkflowRecord, []);
}

export async function getWorkflow(workflowId: string) {
  const supabase = createSupabaseServerClient();

  if (!supabase) {
    return getMemoryWorkflow(workflowId);
  }

  const [{ data: workflowData, error: workflowError }, { data: candidatesData, error: candidatesError }] =
    await Promise.all([
      supabase.from("workflows").select("*").eq("id", workflowId).single(),
      supabase.from("hook_candidates").select("*").eq("workflow_id", workflowId),
    ]);

  if (workflowError || !workflowData) {
    throw new Error(workflowError?.message ?? "워크플로우를 찾을 수 없습니다.");
  }

  if (candidatesError) {
    throw new Error(candidatesError.message);
  }

  return toWorkflow(workflowData as WorkflowRecord, (candidatesData ?? []) as CandidateRecord[]);
}

export async function updateWorkflowStatus(workflowId: string, status: WorkflowStatus) {
  const supabase = createSupabaseServerClient();

  if (!supabase) {
    return patchMemoryWorkflow(workflowId, { status });
  }

  const { data, error } = await supabase
    .from("workflows")
    .update({
      status,
      updated_at: now(),
    })
    .eq("id", workflowId)
    .select()
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "워크플로우 상태를 업데이트하지 못했습니다.");
  }

  const workflow = await getWorkflow(workflowId);
  return {
    ...workflow,
    status: (data as WorkflowRecord).status,
    updatedAt: (data as WorkflowRecord).updated_at,
  };
}

export async function saveConceptAnalysis(workflowId: string, analysis: MainTrackAnalysis) {
  conceptCache.set(workflowId, analysis);
  const supabase = createSupabaseServerClient();

  if (!supabase) {
    const workflow = assertMemoryWorkflow(workflowId);
    const nextWorkflow: Workflow = {
      ...workflow,
      status: "researching",
      mainTrackAnalysis: analysis,
      updatedAt: now(),
    };
    memoryStore.set(workflowId, nextWorkflow);
    return cloneWorkflow(nextWorkflow);
  }

  const { error } = await supabase
    .from("workflows")
    .update({ main_track_analysis: analysis, status: "researching", updated_at: now() })
    .eq("id", workflowId);

  if (error) {
    throw new Error(error.message);
  }

  const workflow = await getWorkflow(workflowId);
  return workflow;
}

export function getCachedConcept(workflowId: string): MainTrackAnalysis | undefined {
  return conceptCache.get(workflowId);
}

export async function saveResearchCandidates(
  workflowId: string,
  candidates: HookCandidate[],
  mainTrackAnalysis?: MainTrackAnalysis,
) {
  const supabase = createSupabaseServerClient();

  if (!supabase) {
    const workflow = assertMemoryWorkflow(workflowId);
    const nextWorkflow: Workflow = {
      ...workflow,
      status: "researched",
      candidates: candidates.map((candidate) => withDerivedHookFit(candidate)),
      mainTrackAnalysis,
      debug: getWorkflowDebug(workflowId),
      updatedAt: now(),
    };

    memoryStore.set(workflowId, nextWorkflow);
    return cloneWorkflow(nextWorkflow);
  }

  const { error: deleteError } = await supabase.from("hook_candidates").delete().eq("workflow_id", workflowId);

  if (deleteError) {
    throw new Error(deleteError.message);
  }

  const payload = candidates.map((candidate) => ({
    id: candidate.id,
    workflow_id: workflowId,
    track_name: candidate.trackName,
    artist_name: candidate.artistName,
    sound_concept: candidate.soundConcept,
    connection_reason: candidate.connectionReason,
    awareness_metric: JSON.stringify(candidate.awarenessMetric),
    research_sources: candidate.researchSources,
    verification_status: null,
    verification_summary: null,
    uncertainty_flags: [],
    verification_sources: [],
    display_order: candidate.displayOrder,
  }));

  const { error: insertError } = await supabase.from("hook_candidates").insert(payload);

  if (insertError) {
    throw new Error(insertError.message);
  }

  await updateWorkflowStatus(workflowId, "researched");
  const workflow = await getWorkflow(workflowId);
  return { ...workflow, mainTrackAnalysis };
}

export async function selectCandidate(workflowId: string, candidateId: string) {
  const supabase = createSupabaseServerClient();

  if (!supabase) {
    const workflow = assertMemoryWorkflow(workflowId);
    const selected = workflow.candidates.some((candidate) => candidate.id === candidateId);
    if (!selected) {
      throw new Error("선택한 후보를 찾을 수 없습니다.");
    }

    const nextWorkflow: Workflow = {
      ...workflow,
      status: "selected",
      selectedCandidateId: candidateId,
      debug: getWorkflowDebug(workflowId),
      updatedAt: now(),
    };

    memoryStore.set(workflowId, nextWorkflow);
    return cloneWorkflow(nextWorkflow);
  }

  const { data, error } = await supabase
    .from("workflows")
    .update({
      status: "selected",
      selected_candidate_id: candidateId,
      updated_at: now(),
    })
    .eq("id", workflowId)
    .select()
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "후보 선택 저장에 실패했습니다.");
  }

  return getWorkflow(workflowId);
}

export async function saveExternalContext(workflowId: string, externalContext: string) {
  const supabase = createSupabaseServerClient();

  if (!supabase) {
    return patchMemoryWorkflow(workflowId, { mainTrackExternalContext: externalContext });
  }

  const { data, error } = await supabase
    .from("workflows")
    .update({ main_track_external_context: externalContext, updated_at: now() })
    .eq("id", workflowId)
    .select()
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "외부 자료 저장에 실패했습니다.");
  }

  return toWorkflow(data as WorkflowRecord, []);
}

export async function listWorkflows(limit = 20) {
  const supabase = createSupabaseServerClient();

  if (!supabase) {
    return [];
  }

  const { data, error } = await supabase
    .from("workflows")
    .select("id, main_track, main_artist, status, created_at, selected_candidate_id")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as Pick<WorkflowRecord, "id" | "main_track" | "main_artist" | "status" | "created_at" | "selected_candidate_id">[];
}

export async function seedResearchFallback(workflowId: string, mainTrack: string, mainArtist: string) {
  const candidates = buildMockCandidates(mainTrack, mainArtist);
  return saveResearchCandidates(workflowId, candidates);
}

export async function saveCopyDraft(workflowId: string, copyDraft: CopyDraft) {
  const supabase = createSupabaseServerClient();
  if (!supabase) {
    return patchMemoryWorkflow(workflowId, { copyDraft });
  }

  const { error } = await supabase
    .from("workflows")
    .update({ copy_draft: copyDraft, updated_at: now() })
    .eq("id", workflowId);

  if (error) throw new Error(error.message);
}

export async function saveTrackDetails(
  workflowId: string,
  trackDetails: TrackDetail[],
  conceptDetail: ConceptDetail,
) {
  const supabase = createSupabaseServerClient();
  if (!supabase) {
    return patchMemoryWorkflow(workflowId, { trackDetails, conceptDetail });
  }

  const { error } = await supabase
    .from("workflows")
    .update({ track_details: trackDetails, concept_detail: conceptDetail, updated_at: now() })
    .eq("id", workflowId);

  if (error) throw new Error(error.message);
}

