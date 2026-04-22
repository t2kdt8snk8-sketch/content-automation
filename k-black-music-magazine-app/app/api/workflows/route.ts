import { NextRequest, NextResponse } from "next/server";
import { createWorkflow, getWorkflow, listWorkflows } from "@/lib/server/workflow-store";
import { handleApiError } from "@/lib/server/api";
import { createWorkflowSchema } from "@/lib/validators/workflow";

export async function GET(request: NextRequest) {
  try {
    const id = request.nextUrl.searchParams.get("id");
    if (id) {
      try {
        const workflow = await getWorkflow(id);
        return NextResponse.json({ workflow });
      } catch (error) {
        const message = error instanceof Error ? error.message : "워크플로우를 찾을 수 없습니다.";
        if (message.includes("찾을 수 없습니다")) {
          return NextResponse.json({ workflow: null, error: message }, { status: 404 });
        }
        throw error;
      }
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
