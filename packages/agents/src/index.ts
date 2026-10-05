export type AgentProvider = "codex" | "claude";
export type AgentWorkflow = "research" | "organize" | "draft";
export type AgentPermission =
  "read-note" | "read-sources" | "propose-note-update";

export type AgentRequest = {
  provider: AgentProvider;
  workflow: AgentWorkflow;
  instruction: string;
  noteId: string;
  noteContent: string;
  sourceContent?: string;
};

export type PendingAgentOperation = {
  id: string;
  provider: AgentProvider;
  workflow: AgentWorkflow;
  instruction: string;
  noteId: string;
  permissions: AgentPermission[];
  promptPreview: string;
  createdAt: string;
  expiresAt: string;
};

export type AgentExecution = {
  operationId: string;
  status: "completed" | "failed";
  output: string;
  error?: string;
  startedAt: string;
  finishedAt: string;
};

export function permissionsFor(workflow: AgentWorkflow): AgentPermission[] {
  if (workflow === "research")
    return ["read-note", "read-sources", "propose-note-update"];
  return ["read-note", "propose-note-update"];
}
