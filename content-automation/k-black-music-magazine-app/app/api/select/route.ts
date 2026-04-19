import { NextRequest, NextResponse } from "next/server";
import { handleApiError } from "@/lib/server/api";
import { selectCandidate } from "@/lib/server/workflow-store";
import { selectCandidateSchema } from "@/lib/validators/workflow";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { workflowId, candidateId } = selectCandidateSchema.parse(body);
    const workflow = await selectCandidate(workflowId, candidateId);

    return NextResponse.json({ workflow });
  } catch (error) {
    return handleApiError(error);
  }
}
