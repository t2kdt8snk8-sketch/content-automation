import { COPYWRITER_SYSTEM_PROMPT, buildCopywriterUserPrompt } from "@/lib/ai/prompts";
import { extractJsonBlock, safeJsonParse } from "@/lib/utils";
import { copyDraftResponseSchema } from "@/lib/validators/workflow";
import type { CopyDraft } from "@/types/workflow";

import type { ConceptDetail, TrackDetail } from "@/types/workflow";

export async function generateCopyDraft(input: {
  hookTrack: string;
  hookArtist: string;
  mainTrack: string;
  mainArtist: string;
  soundConcept: string;
  connectionReason: string;
  trendContext: string;
  trackDetails?: TrackDetail[];
  conceptDetail?: ConceptDetail;
  archive?: string[];
}) {
  const prompt = buildCopywriterUserPrompt(input);

  if (!process.env.ANTHROPIC_API_KEY) {
    return buildMockCopyDraft(input);
  }

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: process.env.COPYWRITER_MODEL ?? "claude-sonnet-4-6",
      max_tokens: 8096,
      temperature: 0.8,
      system: COPYWRITER_SYSTEM_PROMPT,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Claude 카피 생성 실패: ${response.status}\n\n${errorText}`);
  }

  const payload = (await response.json()) as {
    content?: Array<{ type: string; text?: string }>;
  };
  const text = (payload.content ?? [])
    .filter((item) => item.type === "text")
    .map((item) => item.text ?? "")
    .join("\n");

  const json = extractJsonBlock(text);
  const parsed = copyDraftResponseSchema.parse(safeJsonParse(json));

  return {
    hookTrack: input.hookTrack,
    hookArtist: input.hookArtist,
    mainTrack: input.mainTrack,
    mainArtist: input.mainArtist,
    narrativeFlow: parsed.narrativeFlow,
    slides: parsed.slides.map((slide, index) => ({
      id: slide.id || `slide-${index + 1}`,
      section: slide.section,
      headline: slide.headline,
      body: slide.body,
      pointWord: slide.pointWord || "",
    })),
    captionAngle: parsed.captionAngle,
    captionReason: parsed.captionReason,
    caption: parsed.caption,
  } satisfies CopyDraft;
}

function buildMockCopyDraft(input: {
  hookTrack: string;
  hookArtist: string;
  mainTrack: string;
  mainArtist: string;
  soundConcept: string;
  connectionReason: string;
  trendContext: string;
}): CopyDraft {
  return {
    hookTrack: input.hookTrack,
    hookArtist: input.hookArtist,
    mainTrack: input.mainTrack,
    mainArtist: input.mainArtist,
    slides: [
      { id: "slide-1", section: "cover", headline: "당신의 취향, 얼마나 알고 계신가요?", body: "", pointWord: "" },
      { id: "slide-2", section: "provoke", headline: `${input.hookTrack} 들으면서 이것도 모르는 거 아니죠?`, body: "", pointWord: "" },
      { id: "slide-3", section: "hook", headline: `${input.hookTrack}는 귀가 먼저 반응하는 곡입니다.`, body: "한 번 들으면 기억에 남는 질감이 분명합니다.", pointWord: "" },
      { id: "slide-4", section: "hook", headline: "이 곡이 계속 회자되는 이유가 있습니다.", body: input.trendContext, pointWord: "" },
      { id: "slide-5", section: "concept", headline: input.soundConcept, body: input.connectionReason, pointWord: input.soundConcept },
      { id: "slide-6", section: "main", headline: `${input.mainTrack}로 넘어가면 결이 더 선명해집니다.`, body: `${input.mainArtist}는 같은 개념을 더 깊게 밀어붙입니다.`, pointWord: "" },
      { id: "slide-7", section: "main", headline: `${input.mainTrack}는 입구 다음에 도착하는 본편입니다.`, body: "이제 왜 두 곡이 이어지는지 바로 들립니다.", pointWord: "" },
    ],
    captionAngle: "혜택",
    captionReason: "훅 곡을 입구로 삼아 같은 개념이 메인 곡에서 어떻게 확장되는지 보여주기 좋습니다.",
    caption:
      `${input.hookTrack}는 입구 역할을 하고, ${input.mainTrack}는 그 다음 장면을 엽니다.\n\n같은 포인트를 알고 들으면 익숙한 곡도 다르게 들립니다.\n\n이 개념 하나만 잡아두셔도 다음 추천이 훨씬 쉬워집니다.`,
  };
}
