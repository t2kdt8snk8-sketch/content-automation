"use client";

import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import type { WorkflowStatus } from "@/types/workflow";

interface WorkflowSummary {
  id: string;
  main_track: string;
  main_artist: string;
  status: WorkflowStatus;
  created_at: string;
  selected_candidate_id: string | null;
  selected_candidate: { track_name: string; artist_name: string } | null;
  copy_draft: unknown | null;
}

const STATUS_LABEL: Record<WorkflowStatus, string> = {
  draft: "작업 중",
  researching: "작업 중",
  researched: "작업 중",
  selected: "작업 완료",
  failed: "실패",
};

const STATUS_DOT: Record<WorkflowStatus, string> = {
  draft: "bg-sand/40",
  researching: "bg-sand/40",
  researched: "bg-sand/40",
  selected: "bg-bronze",
  failed: "bg-red-400/70",
};

interface HistoryPanelProps {
  onSelect: (id: string) => void;
  onReset: () => void;
}

export function HistoryPanel({ onSelect, onReset }: HistoryPanelProps) {
  const [open, setOpen] = useState(false);
  const [workflows, setWorkflows] = useState<WorkflowSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  function copyWorkflowId(e: React.MouseEvent, id: string) {
    e.stopPropagation();
    void navigator.clipboard.writeText(id).then(() => {
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    });
  }

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setLoadError(null);
    fetch("/api/workflows")
      .then(async (r) => {
        const raw = await r.text();
        let data: { workflows?: WorkflowSummary[]; error?: string } = {};
        try {
          data = JSON.parse(raw) as { workflows?: WorkflowSummary[]; error?: string };
        } catch {
          data = {};
        }
        if (!r.ok) {
          throw new Error(data.error ?? raw.trim() ?? `HTTP ${r.status}`);
        }
        return data;
      })
      .then((data: { workflows?: WorkflowSummary[] }) => {
        setWorkflows(data.workflows ?? []);
      })
      .catch((error) => {
        setWorkflows([]);
        setLoadError(error instanceof Error ? error.message : "히스토리를 불러오지 못했습니다.");
      })
      .finally(() => setLoading(false));
  }, [open]);

  function formatDate(iso: string) {
    const d = new Date(iso);
    return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.06] px-4 py-2 text-xs text-cream/70 transition hover:bg-white/10 hover:text-cream"
      >
        <span>히스토리</span>
        <span className="text-sand/50">↗</span>
      </button>

      {open && createPortal(
        <div className="fixed inset-0 z-50 flex items-end justify-center" onClick={() => setOpen(false)}>
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <div
            className="relative z-10 w-full max-w-[440px] rounded-t-[32px] border border-white/10 bg-[#0d0d0d] p-6 pb-10 max-h-[75vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >

            <div className="mb-5">
              <p className="text-xs uppercase tracking-[0.2em] text-sand/70">History</p>
              <h2 className="mt-1 text-lg font-semibold text-cream">작업 목록</h2>
            </div>

            {loading ? (
              <p className="py-8 text-center text-sm text-cream/40">불러오는 중...</p>
            ) : loadError ? (
              <p className="py-8 text-center text-sm text-red-300/80">{loadError}</p>
            ) : workflows.length === 0 ? (
              <p className="py-8 text-center text-sm text-cream/40">작업 내역이 없어요</p>
            ) : (
              <ul className="space-y-2 overflow-y-auto pr-1 flex-1 min-h-0">
                {workflows.map((w) => (
                  <li key={w.id}>
                    <div className="rounded-2xl border border-white/10 bg-white/[0.04] transition hover:bg-white/[0.08]">
                      <button
                        type="button"
                        onClick={() => {
                          onSelect(w.id);
                          setOpen(false);
                        }}
                        className="w-full p-4 text-left"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-cream">{w.main_track}</p>
                            <p className="mt-0.5 truncate text-xs text-cream/55">{w.main_artist}</p>
                            {w.selected_candidate && (
                              <p className="mt-1.5 truncate text-xs text-bronze/80">
                                ↳ {w.selected_candidate.track_name} · {w.selected_candidate.artist_name}
                              </p>
                            )}
                          </div>
                          <div className="flex shrink-0 flex-col items-end gap-1.5">
                            <div className="flex items-center gap-1.5">
                              <span className={`h-1.5 w-1.5 rounded-full ${STATUS_DOT[w.status]}`} />
                              <span className="text-xs text-cream/60">{STATUS_LABEL[w.status]}</span>
                            </div>
                            <span className="text-[11px] text-cream/35">{formatDate(w.created_at)}</span>
                          </div>
                        </div>
                      </button>
                      {w.copy_draft ? (
                        <div className="border-t border-white/10 px-4 py-3">
                          <button
                            type="button"
                            onClick={(e) => copyWorkflowId(e, w.id)}
                            className="text-xs text-sand/70 hover:text-sand"
                          >
                            {copiedId === w.id ? "Figma ID 복사됨 ✓" : "Figma ID 복사"}
                          </button>
                        </div>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
            )}

            <div className="mt-4 flex gap-2 pt-4 border-t border-white/10">
              <button
                type="button"
                onClick={() => { onReset(); setOpen(false); }}
                className="flex-1 rounded-full border border-white/10 bg-white/[0.06] py-2.5 text-xs text-cream/60 hover:text-cream"
              >
                새로 시작
              </button>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="flex-1 rounded-full border border-white/10 bg-white/[0.06] py-2.5 text-xs text-cream/60 hover:text-cream"
              >
                닫기
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
