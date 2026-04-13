import { NextRequest, NextResponse } from "next/server";
import { handleApiError } from "@/lib/server/api";
import { saveCopyDraft } from "@/lib/server/workflow-store";
import type { CopyDraft } from "@/types/workflow";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as { workflowId: string; copyDraft: CopyDraft };
    await saveCopyDraft(body.workflowId, body.copyDraft);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}
