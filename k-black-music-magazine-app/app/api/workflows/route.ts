import { NextRequest, NextResponse } from "next/server";
import { createWorkflow, getWorkflow, listWorkflows } from "@/lib/server/workflow-store";
import { handleApiError } from "@/lib/server/api";
import { createWorkflowSchema } from "@/lib/validators/workflow";

export async function GET(request: NextRequest) {
  try {
    const id = request.nextUrl.searchParams.get("id");
    if (id) {
      const workflow = await getWorkflow(id);
      return NextResponse.json({ workflow });
    }
    const workflows = await listWorkflows();
    return NextResponse.json({ workflows });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const input = createWorkflowSchema.parse(body);
    const workflow = await createWorkflow(input);

    return NextResponse.json({ workflow });
  } catch (error) {
    return handleApiError(error);
  }
}
