import { NextRequest, NextResponse } from "next/server";
import { generateCopyDraft } from "@/lib/ai/copywriter";
import { handleApiError } from "@/lib/server/api";
import { getWorkflow, saveCopyDraft } from "@/lib/server/workflow-store";
import { getArchive } from "@/lib/server/archive";
import { generateCopySchema } from "@/lib/validators/workflow";
import type { ConceptDetail, TrackDetail } from "@/types/workflow";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { workflowId, candidateId } = generateCopySchema.parse(body);
    const trackDetails = (body.trackDetails ?? []) as TrackDetail[];
    const conceptDetail = (body.conceptDetail ?? undefined) as ConceptDetail | undefined;
    const workflow = await getWorkflow(workflowId);
    const candidate = workflow.candidates.find((item) => item.id === candidateId);

    if (!candidate) {
      return NextResponse.json({ error: "선택한 훅 곡 후보를 찾지 못했습니다." }, { status: 404 });
    }

    const archive = await getArchive();

    const copyDraft = await generateCopyDraft({
      hookTrack: candidate.trackName,
      hookArtist: candidate.artistName,
      mainTrack: workflow.mainTrack,
      mainArtist: workflow.mainArtist,
      soundConcept: candidate.soundConcept,
      connectionReason: candidate.connectionReason,
      trendContext: `인지도 ${candidate.awarenessMetric.level}/5. ${candidate.awarenessMetric.melon}. ${candidate.awarenessMetric.youtube}. ${candidate.awarenessMetric.naver}. 타이밍: ${candidate.awarenessMetric.timing}`,
      trackDetails,
      conceptDetail,
      archive,
    });

    await saveCopyDraft(workflowId, copyDraft);
    return NextResponse.json({ copyDraft });
  } catch (error) {
    return handleApiError(error);
  }
}
