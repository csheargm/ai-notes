import type {
  AgentExecution,
  AgentProvider,
  AgentRequest,
  AgentWorkflow,
  PendingAgentOperation,
} from "@ai-notes/agents";
import { noteText, sources, type Note } from "@ai-notes/notes";
import {
  Bot,
  CheckCircle2,
  Clipboard,
  Play,
  ShieldAlert,
  X,
} from "lucide-react";
import { useState } from "react";

export function AgentPanel({
  note,
  onClose,
}: {
  note: Note;
  onClose: () => void;
}) {
  const [provider, setProvider] = useState<AgentProvider>("codex");
  const [workflow, setWorkflow] = useState<AgentWorkflow>("organize");
  const [instruction, setInstruction] = useState("");
  const [pending, setPending] = useState<PendingAgentOperation>();
  const [execution, setExecution] = useState<AgentExecution>();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const token = sessionStorage.getItem("ai-notes-sync-token") ?? "";
  const baseUrl =
    localStorage.getItem("ai-notes-sync-url")?.replace(/\/$/, "") ?? "";

  const request = async (path: string, body?: unknown) => {
    const response = await fetch(`${baseUrl}${path}`, {
      method: body ? "POST" : "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = (await response.json()) as { error?: string };
    if (!response.ok)
      throw new Error(data.error ?? `Request failed (${response.status}).`);
    return data;
  };

  const prepare = async () => {
    setBusy(true);
    setError("");
    setExecution(undefined);
    try {
      const payload: AgentRequest = {
        provider,
        workflow,
        instruction,
        noteId: note.id,
        noteContent: noteText(note),
        sourceContent: sources(note)
          .map(
            (source) =>
              `${source.title}\n${source.extractedText ?? ""}\n${source.annotations.join("\n")}`,
          )
          .join("\n\n"),
      };
      setPending(
        (await request(
          "/api/agents/prepare",
          payload,
        )) as PendingAgentOperation,
      );
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Could not prepare agent.",
      );
    } finally {
      setBusy(false);
    }
  };

  const execute = async () => {
    if (!pending) return;
    setBusy(true);
    setError("");
    try {
      setExecution(
        (await request(
          `/api/agents/${pending.id}/execute`,
          {},
        )) as AgentExecution,
      );
      setPending(undefined);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Agent failed.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <aside className="agent-panel" aria-label="Agent workflows">
      <header>
        <div>
          <Bot size={17} />
          <strong>Trusted agent</strong>
        </div>
        <button onClick={onClose} aria-label="Close agent panel">
          <X size={18} />
        </button>
      </header>
      {!baseUrl || !token ? (
        <div className="agent-warning">
          <ShieldAlert size={18} />
          <p>
            Connect authenticated Sync first. The same server trust boundary
            protects local agent execution.
          </p>
        </div>
      ) : (
        <>
          <div className="agent-fields">
            <label>
              Provider
              <select
                value={provider}
                onChange={(event) =>
                  setProvider(event.target.value as AgentProvider)
                }
              >
                <option value="codex">Codex CLI</option>
                <option value="claude">Claude CLI</option>
              </select>
            </label>
            <label>
              Workflow
              <select
                value={workflow}
                onChange={(event) =>
                  setWorkflow(event.target.value as AgentWorkflow)
                }
              >
                <option value="organize">Organize note</option>
                <option value="research">Research sources</option>
                <option value="draft">Draft content</option>
              </select>
            </label>
          </div>
          <textarea
            value={instruction}
            onChange={(event) => setInstruction(event.target.value)}
            placeholder="Describe the result you want. The agent can propose content, but cannot edit the note automatically."
            aria-label="Agent instruction"
          />
          <button
            className="prepare-agent"
            disabled={!instruction.trim() || busy}
            onClick={() => void prepare()}
          >
            <Clipboard size={15} /> Prepare for review
          </button>
        </>
      )}
      {pending && (
        <section className="approval-card">
          <div>
            <ShieldAlert size={17} />
            <strong>Review before execution</strong>
          </div>
          <p>{pending.promptPreview}</p>
          <h4>Requested permissions</h4>
          <ul>
            {pending.permissions.map((permission) => (
              <li key={permission}>
                <CheckCircle2 size={13} />
                {permission}
              </li>
            ))}
          </ul>
          <small>
            Approval is single-use and expires at{" "}
            {new Date(pending.expiresAt).toLocaleTimeString()}.
          </small>
          <button disabled={busy} onClick={() => void execute()}>
            <Play size={15} /> Approve and run {pending.provider}
          </button>
        </section>
      )}
      {error && (
        <div className="ai-error">
          <strong>Agent unavailable</strong>
          <p>{error}</p>
        </div>
      )}
      {execution && (
        <section className={`agent-output ${execution.status}`}>
          <strong>
            {execution.status === "completed"
              ? "Proposal ready"
              : "Agent failed"}
          </strong>
          <p>{execution.output || execution.error}</p>
          <small>
            This output has not changed your note. Review and copy only what you
            want.
          </small>
        </section>
      )}
    </aside>
  );
}
