import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AgentService } from "./agent-service.js";

const roots: string[] = [];
afterEach(async () =>
  Promise.all(
    roots.splice(0).map((root) => rm(root, { recursive: true, force: true })),
  ),
);

describe("AgentService", () => {
  it("requires preparation before one-time execution and writes an audit trail", async () => {
    const root = await mkdtemp(join(tmpdir(), "ai-notes-agent-"));
    roots.push(root);
    const runner = vi.fn(async () => "Proposal");
    const audit = join(root, "audit.jsonl");
    const service = new AgentService({ codex: runner }, audit);
    const operation = await service.prepare({
      provider: "codex",
      workflow: "organize",
      instruction: "Organize",
      noteId: "note",
      noteContent: "Content",
    });
    expect(operation.permissions).toContain("propose-note-update");
    expect((await service.execute(operation.id)).output).toBe("Proposal");
    await expect(service.execute(operation.id)).rejects.toThrow("not found");
    expect(await readFile(audit, "utf8")).toContain("completed");
  });
});
