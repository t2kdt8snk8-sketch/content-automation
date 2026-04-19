"use client";

import type { CopyDraft } from "@/types/workflow";

interface CopyEditorProps {
  value: CopyDraft;
  onChange: (next: CopyDraft) => void;
}

export function CopyEditor({ value, onChange }: CopyEditorProps) {
  return (
    <section className="space-y-4">
      <div className="px-1">
        <p className="text-xs uppercase tracking-[0.2em] text-sand/70">Step 5</p>
        <h2 className="mt-2 text-xl font-semibold text-cream">슬라이드 카피 편집</h2>
        <p className="mt-2 text-sm leading-6 text-cream/65">
          Claude가 만든 초안을 바로 수정할 수 있습니다. 수정한 내용이 그대로 PNG export에 반영됩니다.
        </p>
      </div>

      <div className="space-y-4">
        {value.slides.map((slide, index) => (
          <div key={slide.id} className="rounded-[28px] border border-white/10 bg-black/20 p-5">
            <div className="mb-4 flex items-center justify-between">
              <p className="text-sm font-semibold text-cream">
                슬라이드 {index + 1} · {slide.section}
              </p>
              <span className="rounded-full border border-white/10 px-3 py-1 text-xs text-sand/80">{slide.id}</span>
            </div>
            <div className="space-y-3">
              <textarea
                value={slide.headline}
                onChange={(event) =>
                  onChange({
                    ...value,
                    slides: value.slides.map((item) =>
                      item.id === slide.id ? { ...item, headline: event.target.value } : item,
                    ),
                  })
                }
                rows={2}
                className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-base text-cream outline-none"
              />
              {slide.section !== "cover" && slide.section !== "provoke" ? (
                <textarea
                  value={slide.body}
                  onChange={(event) =>
                    onChange({
                      ...value,
                      slides: value.slides.map((item) =>
                        item.id === slide.id ? { ...item, body: event.target.value } : item,
                      ),
                    })
                  }
                  rows={4}
                  className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-cream outline-none"
                />
              ) : null}
              <input
                value={slide.pointWord ?? ""}
                onChange={(event) =>
                  onChange({
                    ...value,
                    slides: value.slides.map((item) =>
                      item.id === slide.id ? { ...item, pointWord: event.target.value } : item,
                    ),
                  })
                }
                placeholder="포인트 단어"
                className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-cream outline-none"
              />
            </div>
          </div>
        ))}
      </div>

      <div className="rounded-[28px] border border-white/10 bg-black/20 p-5">
        <p className="mb-3 text-sm font-semibold text-cream">인스타 캡션</p>
        <div className="space-y-3">
          <input
            value={value.captionAngle}
            onChange={(event) => onChange({ ...value, captionAngle: event.target.value })}
            placeholder="선택 앵글"
            className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-cream outline-none"
          />
          <input
            value={value.captionReason}
            onChange={(event) => onChange({ ...value, captionReason: event.target.value })}
            placeholder="선택 근거"
            className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-cream outline-none"
          />
          <textarea
            value={value.caption}
            onChange={(event) => onChange({ ...value, caption: event.target.value })}
            rows={7}
            className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-cream outline-none"
          />
        </div>
      </div>
    </section>
  );
}
