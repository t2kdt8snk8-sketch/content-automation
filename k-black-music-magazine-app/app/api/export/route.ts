import { NextRequest, NextResponse } from "next/server";
import { exportSlides } from "@/lib/server/export-slides";
import { handleApiError } from "@/lib/server/api";
import { saveToArchive } from "@/lib/server/archive";
import { getWorkflow } from "@/lib/server/workflow-store";
import { exportSlidesSchema } from "@/lib/validators/workflow";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { workflowId, copyDraft } = exportSlidesSchema.parse(body);
    const assets = await exportSlides(workflowId, copyDraft);

    const workflow = await getWorkflow(workflowId);
    const candidateId = workflow.selectedCandidateId;
    const candidate = candidateId
      ? workflow.candidates.find((c) => c.id === candidateId)
      : null;

    if (candidate) {
      await saveToArchive({
        mainTrack: workflow.mainTrack,
        mainArtist: workflow.mainArtist,
        hookTrack: candidate.trackName,
        hookArtist: candidate.artistName,
        concept: candidate.soundConcept,
        awarenessLevel: candidate.awarenessMetric.level,
        captionAngle: copyDraft.captionAngle,
      });
    }

    return NextResponse.json({ assets });
  } catch (error) {
    return handleApiError(error);
  }
}
