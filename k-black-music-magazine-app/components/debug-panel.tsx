"use client";

import type { ModelDebugLog, WorkflowDebug } from "@/types/workflow";

function ModelSection({ title, log }: { title: string; log?: ModelDebugLog }) {
  if (!log) {
    return (
      <div className="rounded-3xl border border-white/10 bg-black/20 p-5">
        <p className="text-sm font-semibold text-cream">{title}</p>
        <p className="mt-2 text-sm text-cream/60">아직 실행 기록이 없습니다.</p>
      </div>
    );
  }

  return (
    <div className="rounded-3xl border border-white/10 bg-black/20 p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <p className="text-sm font-semibold text-cream">{title}</p>
        <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-sand/80">
          {log.model}
        </span>
      </div>

      {log.error ? (
        <div className="mb-4 rounded-2xl border border-rose/30 bg-rose/10 p-4 text-sm text-cream/85">
          {log.error}
        </div>
      ) : null}

      {log.sources.length > 0 ? (
        <div className="mb-4">
          <p className="mb-2 text-xs uppercase tracking-[0.18em] text-sand/60">출처 링크</p>
          <div className="space-y-2">
            {log.sources.map((source) => (
              <a
                key={`${source.url}-${source.title}`}
                href={source.url}
                target="_blank"
                rel="noreferrer"
                className="block rounded-2xl border border-white/10 bg-white/[0.04] p-3"
              >
                <p className="text-sm font-medium text-cream">{source.title}</p>
                <p className="mt-1 break-all text-xs text-cream/55">{source.url}</p>
              </a>
            ))}
          </div>
        </div>
      ) : null}

      {log.searchNotes?.length ? (
        <div className="mb-4">
          <p className="mb-2 text-xs uppercase tracking-[0.18em] text-sand/60">검색 메모</p>
          <ul className="space-y-2">
            {log.searchNotes.map((note) => (
              <li key={note} className="text-sm text-cream/72">
                {note}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {log.prompt ? (
        <details className="mb-4 rounded-2xl border border-white/10 bg-black/15 p-4">
          <summary className="cursor-pointer text-sm font-medium text-cream">프롬프트 보기</summary>
          <pre className="mt-3 whitespace-pre-wrap break-words text-xs leading-6 text-cream/70">{log.prompt}</pre>
        </details>
      ) : null}

      {log.rawText ? (
        <details className="mb-4 rounded-2xl border border-white/10 bg-black/15 p-4">
          <summary className="cursor-pointer text-sm font-medium text-cream">모델 텍스트 보기</summary>
          <pre className="mt-3 whitespace-pre-wrap break-words text-xs leading-6 text-cream/70">{log.rawText}</pre>
        </details>
      ) : null}

      {log.rawResponse ? (
        <details className="rounded-2xl border border-white/10 bg-black/15 p-4">
          <summary className="cursor-pointer text-sm font-medium text-cream">원본 응답 보기</summary>
          <pre className="mt-3 max-h-72 overflow-auto whitespace-pre-wrap break-words text-xs leading-6 text-cream/70">
            {log.rawResponse}
          </pre>
        </details>
      ) : null}
    </div>
  );
}

export function DebugPanel({ debug }: { debug?: WorkflowDebug }) {
  return (
    <details className="rounded-[28px] border border-white/10 bg-black/20 p-5">
      <summary className="cursor-pointer list-none">
        <div className="pr-8">
          <p className="text-xs uppercase tracking-[0.2em] text-sand/70">Debug</p>
          <h2 className="mt-2 text-xl font-semibold text-cream">리서치 / 검증 로그</h2>
          <p className="mt-2 text-sm leading-6 text-cream/65">
            로컬 검수용으로 Gemini와 Claude가 돌린 결과, 출처, 원문 응답을 확인할 수 있습니다.
          </p>
        </div>
      </summary>
      <div className="mt-4 space-y-4">
        <ModelSection title="Gemini 리서치" log={debug?.gemini} />
        <ModelSection title="Claude 검증" log={debug?.claude} />
      </div>
    </details>
  );
}
