import { NextRequest, NextResponse } from "next/server";
import { getWorkflow } from "@/lib/server/workflow-store";
import { handleApiError } from "@/lib/server/api";

export const dynamic = "force-dynamic";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

export async function GET(request: NextRequest) {
  try {
    const workflowId = request.nextUrl.searchParams.get("workflowId");
    if (!workflowId) {
      return NextResponse.json({ error: "workflowId가 필요합니다." }, { status: 400, headers: CORS });
    }

    const workflow = await getWorkflow(workflowId);
    if (!workflow.copyDraft) {
      return NextResponse.json({ error: "카피 데이터가 없습니다. 먼저 카피를 생성해 주세요." }, { status: 404, headers: CORS });
    }

    const { copyDraft } = workflow;

    return NextResponse.json(
      {
        hookTrack: copyDraft.hookTrack,
        hookArtist: copyDraft.hookArtist,
        slides: copyDraft.slides.map((s) => ({
          id: s.id,
          section: s.section,
          headline: s.headline,
          body: s.body ?? "",
          pointWord: s.pointWord ?? "",
        })),
        caption: copyDraft.caption,
      },
      { headers: CORS },
    );
  } catch (error) {
    const res = handleApiError(error);
    // CORS 헤더 추가
    Object.entries(CORS).forEach(([k, v]) => res.headers.set(k, v));
    return res;
  }
}
