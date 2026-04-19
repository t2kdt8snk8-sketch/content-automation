"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CopyEditor } from "@/components/copy-editor";
import { CopyWorkflowPanel } from "@/components/copy-workflow-panel";
import { ConceptCard } from "@/components/concept-card";
import { EmptyState } from "@/components/empty-state";
import { HistoryPanel } from "@/components/history-panel";
import { DebugPanel } from "@/components/debug-panel";
import { ErrorState } from "@/components/error-state";
import { HookCandidateList } from "@/components/hook-candidate-list";
import { InputForm } from "@/components/input-form";
import { ResearchProgressPanel } from "@/components/research-progress-panel";
import { SelectedCandidateSummary } from "@/components/selected-candidate-summary";
import { SelectionBar } from "@/components/selection-bar";
import { WorkflowStepper } from "@/components/workflow-stepper";
import type { ConceptDetail, CopyDraft, ExportedAsset, TrackDetail, Workflow, WorkflowStatus } from "@/types/workflow";

type BusyStage = "idle" | "submitting" | "selecting" | "detailing" | "copying" | "exporting";

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

async function postJson<T>(url: string, payload: unknown) {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const raw = await response.text();
  let data: (T & { error?: string }) | null = null;

  try {
    data = JSON.parse(raw) as T & { error?: string };
  } catch {
    data = null;
  }

  if (!response.ok) {
    const message =
      data?.error ||
      raw.trim() ||
      `요청 처리 중 오류가 발생했습니다. (${response.status})`;
    throw new Error(`${url} ${response.status}: ${message}`);
  }

  if (!data) {
    throw new Error(`${url} 응답을 JSON으로 읽지 못했습니다.\n\n응답 원문:\n${raw.slice(0, 1200)}`);
  }

  return data;
}

export default function HomePage() {
  const [workflow, setWorkflow] = useState<Workflow | null>(null);
  const [busyStage, setBusyStage] = useState<BusyStage>("idle");
  const [status, setStatus] = useState<WorkflowStatus | "idle">("idle");
  const [error, setError] = useState<string | null>(null);
  const [selectedCandidateId, setSelectedCandidateId] = useState<string | null>(null);
  const [trackDetails, setTrackDetails] = useState<TrackDetail[] | null>(null);
  const [conceptDetail, setConceptDetail] = useState<ConceptDetail | null>(null);
  const [mainTrackExternalContext, setMainTrackExternalContext] = useState<string | undefined>(undefined);
  const [copyDraft, setCopyDraft] = useState<CopyDraft | null>(null);
  const [assets, setAssets] = useState<ExportedAsset[]>([]);
  const [exportError, setExportError] = useState<string | null>(null);

  // 새로고침 후 복원
  useEffect(() => {
    const savedId = localStorage.getItem("kblack_workflow_id");
    const savedCandidateId = localStorage.getItem("kblack_selected_candidate_id");
    if (!savedId) return;

    fetch(`/api/workflows?id=${savedId}`)
      .then((r) => r.json())
      .then((data: { workflow?: Workflow }) => {
        if (!data.workflow) {
          localStorage.removeItem("kblack_workflow_id");
          localStorage.removeItem("kblack_selected_candidate_id");
          return;
        }
        setWorkflow(data.workflow);
        setStatus(data.workflow.status);
        if (savedCandidateId) setSelectedCandidateId(savedCandidateId);
        if (data.workflow.mainTrackExternalContext) {
          setMainTrackExternalContext(data.workflow.mainTrackExternalContext);
        }
      })
      .catch(() => {
        localStorage.removeItem("kblack_workflow_id");
        localStorage.removeItem("kblack_selected_candidate_id");
        localStorage.removeItem("kblack_external_context");
      });
  }, []);

  const isSubmitting = busyStage === "submitting";
  const isSelecting = busyStage === "selecting";
  const isDetailing = busyStage === "detailing";
  const isCopying = busyStage === "copying";
  const isExporting = busyStage === "exporting";

  const selectedTrackLabel = useMemo(() => {
    const candidateId = selectedCandidateId ?? workflow?.selectedCandidateId;
    const selected = workflow?.candidates.find((candidate) => candidate.id === candidateId);
    if (selected) return `${selected.trackName} · ${selected.artistName}`;
    if (copyDraft) return `${copyDraft.hookTrack} · ${copyDraft.hookArtist}`;
    return undefined;
  }, [selectedCandidateId, workflow?.selectedCandidateId, workflow?.candidates, copyDraft]);

  const selectedCandidate = useMemo(() => {
    const candidateId = selectedCandidateId ?? workflow?.selectedCandidateId;
    if (!workflow || !candidateId) {
      return null;
    }

    return workflow.candidates.find((candidate) => candidate.id === candidateId) ?? null;
  }, [selectedCandidateId, workflow]);

  function resetWorkflow() {
    localStorage.removeItem("kblack_workflow_id");
    localStorage.removeItem("kblack_selected_candidate_id");
    setWorkflow(null);
    setStatus("idle");
    setSelectedCandidateId(null);
    setMainTrackExternalContext(undefined);
    setTrackDetails(null);
    setConceptDetail(null);
    setCopyDraft(null);
    setAssets([]);
    setError(null);
  }

  async function restoreWorkflow(workflowId: string) {
    try {
      const res = await fetch(`/api/workflows?id=${workflowId}`);
      const data = await res.json() as { workflow?: Workflow };
      if (!data.workflow) throw new Error();
      setWorkflow(data.workflow);
      setStatus(data.workflow.status);
      setSelectedCandidateId(data.workflow.selectedCandidateId ?? null);
      setMainTrackExternalContext(data.workflow.mainTrackExternalContext);
      setTrackDetails(data.workflow.trackDetails ?? null);
      setConceptDetail(data.workflow.conceptDetail ?? null);
      setCopyDraft(data.workflow.copyDraft ?? null);
      setAssets([]);
      setError(null);
      localStorage.setItem("kblack_workflow_id", workflowId);
      if (data.workflow.selectedCandidateId) {
        localStorage.setItem("kblack_selected_candidate_id", data.workflow.selectedCandidateId);
      }
    } catch {
      setError("작업 내역을 불러오지 못했습니다.");
    }
  }

  async function runWorkflow(values: { mainTrack: string; mainArtist: string }) {
    try {
      setError(null);
      setWorkflow(null);
      setSelectedCandidateId(null);
      setTrackDetails(null);
      setCopyDraft(null);
      setAssets([]);
      setBusyStage("submitting");

      let created: { workflow: Workflow };
      try {
        created = await postJson<{ workflow: Workflow }>("/api/workflows", values);
      } catch (error) {
        throw new Error(`워크플로우 생성 단계 실패: ${getErrorMessage(error, "메인 곡 세션을 만들지 못했습니다.")}`);
      }
      setWorkflow(created.workflow);
      setStatus(created.workflow.status);
      localStorage.setItem("kblack_workflow_id", created.workflow.id);
      localStorage.removeItem("kblack_selected_candidate_id");

      let concepted: { workflow: Workflow; mainTrackExternalContext?: string };
      try {
        concepted = await postJson<{ workflow: Workflow; mainTrackExternalContext?: string }>("/api/research", {
          workflowId: created.workflow.id,
        });
      } catch (error) {
        throw new Error(`개념 추출 단계 실패: ${getErrorMessage(error, "메인 곡 핵심 개념을 추출하지 못했습니다.")}`);
      }
      setWorkflow(concepted.workflow);
      setStatus(concepted.workflow.status);
      setMainTrackExternalContext(concepted.mainTrackExternalContext);

      let researched: { workflow: Workflow };
      try {
        researched = await postJson<{ workflow: Workflow }>("/api/candidates", {
          workflowId: created.workflow.id,
        });
      } catch (error) {
        throw new Error(`후보 탐색 단계 실패: ${getErrorMessage(error, "훅 곡 후보 5개를 만들지 못했습니다.")}`);
      }
      setWorkflow(researched.workflow);
      setStatus(researched.workflow.status);
    } catch (submitError) {
      setError(getErrorMessage(submitError, "작업을 완료하지 못했습니다."));
      setStatus("failed");
    } finally {
      setBusyStage("idle");
    }
  }

  async function confirmSelection() {
    if (!workflow || !selectedCandidateId) {
      return;
    }

    try {
      setError(null);
      setBusyStage("selecting");
      setCopyDraft(null);
      setAssets([]);
      const result = await postJson<{ workflow: Workflow }>("/api/select", {
        workflowId: workflow.id,
        candidateId: selectedCandidateId,
      });
      setWorkflow(result.workflow);
      setStatus(result.workflow.status);
      localStorage.setItem("kblack_selected_candidate_id", selectedCandidateId);
    } catch (selectionError) {
      setError(`후보 선택 단계 실패: ${getErrorMessage(selectionError, "선택 저장에 실패했습니다.")}`);
    } finally {
      setBusyStage("idle");
    }
  }

  async function fetchTrackDetails() {
    const candidateId = selectedCandidateId ?? workflow?.selectedCandidateId;
    if (!workflow || !candidateId) return;

    try {
      setError(null);
      setTrackDetails(null);
      setConceptDetail(null);
      setBusyStage("detailing");
      const result = await postJson<{ trackDetails: TrackDetail[]; conceptDetail: ConceptDetail }>("/api/track-details", {
        workflowId: workflow.id,
        candidateId,
        mainTrackExternalContext,
      });
      setTrackDetails(result.trackDetails);
      setConceptDetail(result.conceptDetail);
    } catch (err) {
      setError(`곡 상세 리서치 단계 실패: ${getErrorMessage(err, "곡 정보 리서치에 실패했습니다.")}`);
    } finally {
      setBusyStage("idle");
    }
  }

  async function generateCopy() {
    let candidateId = selectedCandidateId ?? workflow?.selectedCandidateId;
    if (!candidateId && copyDraft && workflow) {
      const matched = workflow.candidates.find(
        (c) => c.trackName === copyDraft.hookTrack && c.artistName === copyDraft.hookArtist,
      );
      if (matched) candidateId = matched.id;
    }
    if (!workflow || !candidateId) return;

    try {
      setError(null);
      setBusyStage("copying");
      const result = await postJson<{ copyDraft: CopyDraft }>("/api/copy", {
        workflowId: workflow.id,
        candidateId,
        trackDetails: trackDetails ?? [],
        conceptDetail: conceptDetail ?? undefined,
      });
      setCopyDraft(result.copyDraft);
      setAssets([]);
    } catch (copyError) {
      setError(`카피 생성 단계 실패: ${getErrorMessage(copyError, "카피 생성에 실패했습니다.")}`);
    } finally {
      setBusyStage("idle");
    }
  }

  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleCopyDraftChange = useCallback(
    (next: CopyDraft) => {
      setCopyDraft(next);
      if (!workflow) return;
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => {
        void postJson("/api/copy/save", { workflowId: workflow.id, copyDraft: next }).catch(() => {});
      }, 500);
    },
    [workflow],
  );

  async function exportCopy() {
    if (!workflow || !copyDraft) {
      return;
    }

    try {
      setExportError(null);
      setBusyStage("exporting");
      const result = await postJson<{ assets: ExportedAsset[] }>("/api/export", {
        workflowId: workflow.id,
        copyDraft,
      });
      setAssets(result.assets);
    } catch (err) {
      setExportError(`에셋 export 단계 실패: ${getErrorMessage(err, "PNG export에 실패했습니다.")}`);
    } finally {
      setBusyStage("idle");
    }
  }

  return (
    <main className="min-h-screen bg-hero-radial px-4 py-6">
      <div className="mx-auto flex min-h-[100dvh] w-full max-w-[440px] flex-col gap-5 pb-24">
        <section className="rounded-[32px] border border-white/10 bg-black/20 p-6 backdrop-blur-sm">
          <div className="flex items-start justify-between">
            <p className="text-xs uppercase tracking-[0.26em] text-sand/70">K-Black Music Magazine</p>
            <HistoryPanel onSelect={restoreWorkflow} onReset={resetWorkflow} />
          </div>
          <h1 className="mt-3 text-[2rem] font-semibold leading-tight text-cream">
            인스타용 훅 곡
            <br />
            리서치 워크플로우
          </h1>
          <p className="mt-3 text-sm leading-6 text-cream/68">
            메인 곡 한 개를 기준으로 훅 곡 후보 5개를 Gemini로 리서치합니다.
          </p>
          <div className="mt-5 rounded-2xl border border-white/10 bg-white/[0.04] p-4">
            <p className="text-sm leading-6 text-cream/72">
              지금 범위: <span className="font-semibold text-cream">1단계 입력</span>부터{" "}
              <span className="font-semibold text-cream">3단계 선택</span>까지
            </p>
          </div>
        </section>

        <WorkflowStepper status={status} />

        <section className="rounded-[32px] border border-white/10 bg-black/20 p-6 backdrop-blur-sm">
          <div className="mb-5">
            <p className="text-xs uppercase tracking-[0.2em] text-sand/70">Step 1</p>
            <h2 className="mt-2 text-xl font-semibold text-cream">메인 곡 입력</h2>
            <p className="mt-2 text-sm leading-6 text-cream/65">
              예시처럼 곡명과 아티스트명만 넣으면 됩니다. Gemini 리서치가 자동 실행됩니다.
            </p>
          </div>
          <InputForm onSubmit={runWorkflow} disabled={isSubmitting} />
        </section>

        <ResearchProgressPanel status={status} isBusy={busyStage !== "idle"} />

        {error ? <ErrorState message={error} /> : null}

        {workflow?.mainTrackAnalysis ? (
          <ConceptCard analysis={workflow.mainTrackAnalysis} />
        ) : null}

        <section className="space-y-4">
          <div className="px-1">
            <p className="text-xs uppercase tracking-[0.2em] text-sand/70">Step 2-3</p>
            <h2 className="mt-2 text-xl font-semibold text-cream">후보 카드</h2>
          </div>

          {workflow?.candidates.length ? (
            <HookCandidateList
              candidates={workflow.candidates}
              selectedCandidateId={selectedCandidateId ?? workflow.selectedCandidateId}
              disabled={isSubmitting || isSelecting}
              onSelect={setSelectedCandidateId}
            />
          ) : (
            <EmptyState />
          )}
        </section>

        {workflow ? <DebugPanel debug={workflow.debug} /> : null}

        {selectedCandidate ? <SelectedCandidateSummary candidate={selectedCandidate} /> : null}

        {workflow?.selectedCandidateId || selectedCandidateId || copyDraft ? (
          <CopyWorkflowPanel
            selectedTrackLabel={selectedTrackLabel}
            trackDetails={trackDetails}
            copyDraft={copyDraft}
            assets={assets}
            detailing={isDetailing}
            generating={isCopying}
            exporting={isExporting}
            exportError={exportError}
            onDetail={fetchTrackDetails}
            onGenerate={generateCopy}
            onExport={exportCopy}
          />
        ) : null}

        {copyDraft ? <CopyEditor value={copyDraft} onChange={handleCopyDraftChange} /> : null}

        {workflow?.candidates.length ? (
          <SelectionBar
            selectedTrackLabel={selectedTrackLabel}
            disabled={isSubmitting || isSelecting || isCopying || isExporting || status !== "researched"}
            onConfirm={confirmSelection}
          />
        ) : null}
      </div>
    </main>
  );
}
