import { NextRequest, NextResponse } from "next/server";
import { runConceptExtraction } from "@/lib/server/workflow-service";
import { collectYouTubeSources } from "@/lib/collectors/youtube";
import { collectWebzineSources } from "@/lib/collectors/webzine";
import { handleApiError } from "@/lib/server/api";
import { getWorkflow, saveExternalContext } from "@/lib/server/workflow-store";
import { workflowIdSchema } from "@/lib/validators/workflow";

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
    const { workflowId } = workflowIdSchema.parse(body);
    const workflow = await getWorkflow(workflowId);

    // 메인 곡 외부 자료 수집 (실패해도 graceful fallback)
    const [youtubeSettled, webzineSettled] = await Promise.allSettled([
      collectYouTubeSources(workflow.mainTrack, workflow.mainArtist),
      collectWebzineSources(workflow.mainTrack, workflow.mainArtist),
    ]);

    const youtubeResults = youtubeSettled.status === "fulfilled" ? youtubeSettled.value : [];
    const webzineResults = webzineSettled.status === "fulfilled" ? webzineSettled.value : [];
    const mainTrackExternalContext = buildExternalContext(youtubeResults, webzineResults) || undefined;

    if (mainTrackExternalContext) {
      await saveExternalContext(workflowId, mainTrackExternalContext);
    }

    const updatedWorkflow = await runConceptExtraction(workflowId, mainTrackExternalContext);

    return NextResponse.json({ workflow: updatedWorkflow, mainTrackExternalContext });
  } catch (error) {
    return handleApiError(error);
  }
}
