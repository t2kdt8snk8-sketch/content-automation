import { NextRequest, NextResponse } from "next/server";
import { researchConceptDetail, researchTrackDetails } from "@/lib/ai/gemini";
import { collectYouTubeSources } from "@/lib/collectors/youtube";
import { collectWebzineSources } from "@/lib/collectors/webzine";
import { handleApiError } from "@/lib/server/api";
import { getWorkflow, saveTrackDetails } from "@/lib/server/workflow-store";
import { z } from "zod";

const schema = z.object({
  workflowId: z.string().uuid(),
  candidateId: z.string().uuid(),
  mainTrackExternalContext: z.string().optional(),
});

const MAX_CONTEXT_CHARS = 8000;

function buildExternalContext(
  youtubeResults: Awaited<ReturnType<typeof collectYouTubeSources>>,
  webzineResults: Awaited<ReturnType<typeof collectWebzineSources>>,
): string {
  const lines: string[] = [];

  if (youtubeResults.length > 0) {
    lines.push("--- YouTube 영상 자막/설명 ---");
    for (const item of youtubeResults.slice(0, 3)) {
      lines.push(`[영상 제목] ${item.title}`);
      lines.push(`[URL] ${item.url}`);
      lines.push(item.text.trim());
      lines.push("");
    }
  }

  if (webzineResults.length > 0) {
    lines.push("--- 음악 웹진 기사 ---");
    for (const item of webzineResults.slice(0, 5)) {
      lines.push(`[출처] ${item.source} | ${item.title}`);
      lines.push(`[URL] ${item.url}`);
      lines.push(item.snippet.trim());
      lines.push("");
    }
  }

  const joined = lines.join("\n");
  return joined.length > MAX_CONTEXT_CHARS ? joined.slice(0, MAX_CONTEXT_CHARS) + "\n...(생략)" : joined;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { workflowId, candidateId, mainTrackExternalContext } = schema.parse(body);
    const workflow = await getWorkflow(workflowId);
    const candidate = workflow.candidates.find((c) => c.id === candidateId);

    if (!candidate) {
      return NextResponse.json({ error: "후보를 찾지 못했습니다." }, { status: 404 });
    }

    const concept = workflow.mainTrackAnalysis?.concept ?? candidate.soundConcept;
    const conceptExplanation = workflow.mainTrackAnalysis?.conceptExplanation ?? candidate.connectionReason;

    // 훅 곡 외부 자료 수집 (실패해도 graceful fallback)
    const [youtubeSettled, webzineSettled] = await Promise.allSettled([
      collectYouTubeSources(candidate.trackName, candidate.artistName),
      collectWebzineSources(candidate.trackName, candidate.artistName),
    ]);

    const youtubeResults = youtubeSettled.status === "fulfilled" ? youtubeSettled.value : [];
    const webzineResults = webzineSettled.status === "fulfilled" ? webzineSettled.value : [];
    const hookTrackExternalContext = buildExternalContext(youtubeResults, webzineResults);

    // 훅 곡 + 메인 곡 외부 자료 합산 → 4-B(개념 구현 분석)에만 활용
    const conceptExternalContext = [mainTrackExternalContext, hookTrackExternalContext]
      .filter(Boolean)
      .join("\n\n") || undefined;

    // 4-A: Flash 모델로 감상 원재료/TMI 수집
    const trackDetails = await researchTrackDetails({
      hookTrack: candidate.trackName,
      hookArtist: candidate.artistName,
      mainTrack: workflow.mainTrack,
      mainArtist: workflow.mainArtist,
    });

    // 4-B: Pro 모델로 개념 구현 분석 (4-A 완료 후 순차 실행)
    const conceptDetail = await researchConceptDetail({
      hookTrack: candidate.trackName,
      hookArtist: candidate.artistName,
      mainTrack: workflow.mainTrack,
      mainArtist: workflow.mainArtist,
      concept,
      conceptExplanation,
      externalContext: conceptExternalContext,
    });

    await saveTrackDetails(workflowId, trackDetails, conceptDetail);
    return NextResponse.json({ trackDetails, conceptDetail });
  } catch (error) {
    return handleApiError(error);
  }
}
