import { NextRequest, NextResponse } from "next/server";
import { runCandidateSearch } from "@/lib/server/workflow-service";
import { handleApiError } from "@/lib/server/api";
import { workflowIdSchema } from "@/lib/validators/workflow";

export const maxDuration = 60;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { workflowId } = workflowIdSchema.parse(body);
    const workflow = await runCandidateSearch(workflowId);

    return NextResponse.json({ workflow });
  } catch (error) {
    return handleApiError(error);
  }
}
