import { spawn } from "node:child_process";
import { appendFile, mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import { randomUUID } from "node:crypto";
import {
  permissionsFor,
  type AgentExecution,
  type AgentProvider,
  type AgentRequest,
  type PendingAgentOperation,
} from "@ai-notes/agents";

type Runner = (prompt: string) => Promise<string>;

function buildPrompt(request: AgentRequest): string {
  const workflow =
    request.workflow === "research"
      ? "Research the instruction using only the supplied note and sources. Cite source labels and clearly mark uncertainty."
      : request.workflow === "organize"
        ? "Propose a clearer organization for this note. Preserve facts and return Markdown; do not claim to have edited anything."
        : "Draft content requested by the instruction using the supplied note. Return Markdown and distinguish new suggestions from source facts.";
  return `${workflow}\n\nInstruction: ${request.instruction}\n\n[Note ${request.noteId}]\n${request.noteContent}${request.sourceContent ? `\n\n[Sources]\n${request.sourceContent}` : ""}`;
}

export function cliRunner(
  command: string,
  args: string[],
  cwd: string,
  timeoutMs = 120_000,
): Runner {
  return (prompt) =>
    new Promise((resolve, reject) => {
      const child = spawn(command, args, {
        cwd,
        shell: false,
        stdio: ["pipe", "pipe", "pipe"],
        env: { ...process.env, NO_COLOR: "1" },
      });
      let stdout = "";
      let stderr = "";
      const timer = setTimeout(() => {
        child.kill("SIGTERM");
        reject(new Error(`${command} timed out.`));
      }, timeoutMs);
      child.stdout.on("data", (chunk) => {
        stdout += String(chunk);
        if (stdout.length > 2_000_000) child.kill("SIGTERM");
      });
      child.stderr.on("data", (chunk) => {
        stderr += String(chunk);
      });
      child.on("error", (error) => {
        clearTimeout(timer);
        reject(error);
      });
      child.on("close", (code) => {
        clearTimeout(timer);
        if (code === 0) resolve(stdout.trim());
        else
          reject(
            new Error(stderr.trim() || `${command} exited with code ${code}.`),
          );
      });
      child.stdin.end(prompt);
    });
}

export class AgentService {
  private readonly pending = new Map<
    string,
    { operation: PendingAgentOperation; prompt: string }
  >();

  constructor(
    private readonly runners: Partial<Record<AgentProvider, Runner>>,
    private readonly auditPath: string,
  ) {}

  async prepare(request: AgentRequest): Promise<PendingAgentOperation> {
    if (!this.runners[request.provider])
      throw new Error(`${request.provider} agent is not enabled.`);
    if (!request.instruction.trim() || !request.noteContent.trim())
      throw new Error("Instruction and note content are required.");
    const now = Date.now();
    const prompt = buildPrompt(request);
    const operation: PendingAgentOperation = {
      id: randomUUID(),
      provider: request.provider,
      workflow: request.workflow,
      instruction: request.instruction.trim(),
      noteId: request.noteId,
      permissions: permissionsFor(request.workflow),
      promptPreview: prompt.slice(0, 1000),
      createdAt: new Date(now).toISOString(),
      expiresAt: new Date(now + 10 * 60_000).toISOString(),
    };
    this.pending.set(operation.id, { operation, prompt });
    await this.audit({ event: "prepared", operation });
    return operation;
  }

  async execute(id: string): Promise<AgentExecution> {
    const pending = this.pending.get(id);
    if (!pending)
      throw new Error("Agent operation was not found or was already used.");
    this.pending.delete(id);
    if (Date.parse(pending.operation.expiresAt) < Date.now())
      throw new Error("Agent approval expired.");
    const runner = this.runners[pending.operation.provider];
    if (!runner) throw new Error("Agent provider is unavailable.");
    const startedAt = new Date().toISOString();
    try {
      const output = await runner(pending.prompt);
      const execution: AgentExecution = {
        operationId: id,
        status: "completed",
        output,
        startedAt,
        finishedAt: new Date().toISOString(),
      };
      await this.audit({
        event: "completed",
        operation: pending.operation,
        execution,
      });
      return execution;
    } catch (error) {
      const execution: AgentExecution = {
        operationId: id,
        status: "failed",
        output: "",
        error: error instanceof Error ? error.message : "Agent failed.",
        startedAt,
        finishedAt: new Date().toISOString(),
      };
      await this.audit({
        event: "failed",
        operation: pending.operation,
        execution,
      });
      return execution;
    }
  }

  private async audit(entry: unknown) {
    await mkdir(dirname(this.auditPath), { recursive: true });
    await appendFile(
      this.auditPath,
      `${JSON.stringify({ timestamp: new Date().toISOString(), ...(entry as object) })}\n`,
      { mode: 0o600 },
    );
  }
}
