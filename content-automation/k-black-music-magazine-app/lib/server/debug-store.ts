import type { WorkflowDebug } from "@/types/workflow";

const debugStore = new Map<string, WorkflowDebug>();

export function getWorkflowDebug(workflowId: string) {
  return debugStore.get(workflowId);
}

export function setWorkflowDebug(workflowId: string, patch: Partial<WorkflowDebug>) {
  const current = debugStore.get(workflowId) ?? {};
  debugStore.set(workflowId, {
    ...current,
    ...patch,
  });
}

export function clearWorkflowDebug(workflowId: string) {
  debugStore.delete(workflowId);
}
