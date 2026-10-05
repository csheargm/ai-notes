import type { AIProfile, AITask } from "@ai-notes/ai";
import type { Note } from "@ai-notes/notes";
import { noteText } from "@ai-notes/notes";
import {
  CheckSquare,
  HelpCircle,
  Lightbulb,
  ListTree,
  Sparkles,
  Tags,
  Wand2,
  X,
} from "lucide-react";
import { useState } from "react";

const actions: Array<{ task: AITask; label: string; icon: typeof Sparkles }> = [
  { task: "summarize", label: "Summarize", icon: ListTree },
  { task: "explain", label: "Explain", icon: Lightbulb },
  { task: "rewrite", label: "Rewrite", icon: Wand2 },
  { task: "action-items", label: "Action items", icon: CheckSquare },
  { task: "generate-tags", label: "Suggest tags", icon: Tags },
  { task: "ask-note", label: "Ask note", icon: HelpCircle },
];

export function AIPanel({
  note,
  onClose,
}: {
  note: Note;
  onClose: () => void;
}) {
  const [profile, setProfile] = useState<AIProfile>("local");
  const [task, setTask] = useState<AITask>("summarize");
  const [question, setQuestion] = useState("");
  const [result, setResult] = useState("");
  const [provenance, setProvenance] = useState("");
  const [error, setError] = useState("");
  const [running, setRunning] = useState(false);

  const run = async (nextTask = task) => {
    setTask(nextTask);
    setResult("");
    setError("");
    setProvenance("");
    setRunning(true);
    try {
      const input =
        nextTask === "ask-note" && question.trim()
          ? `Question: ${question.trim()}\n\nNote:\n${noteText(note)}`
          : noteText(note);
      const response = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          task: nextTask,
          profile,
          input,
          context: [{ sourceId: note.id, content: noteText(note) }],
        }),
      });
      if (!response.ok) {
        const data = (await response.json()) as { error?: string };
        throw new Error(data.error ?? "AI request failed.");
      }
      const reader = response.body?.getReader();
      if (!reader)
        throw new Error("Streaming is not supported by this browser.");
      const decoder = new TextDecoder();
      let pending = "";
      while (true) {
        const { value, done } = await reader.read();
        pending += decoder.decode(value, { stream: !done });
        const lines = pending.split("\n");
        pending = lines.pop() ?? "";
        for (const line of lines.filter(Boolean)) {
          const event = JSON.parse(line) as {
            type: string;
            value?: string;
            providerId?: string;
            model?: string;
            error?: string;
          };
          if (event.type === "delta")
            setResult((current) => current + (event.value ?? ""));
          if (event.type === "done")
            setProvenance(
              [event.providerId, event.model].filter(Boolean).join(" · "),
            );
          if (event.type === "error")
            throw new Error(event.error ?? "AI request failed.");
        }
        if (done) break;
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "AI request failed.");
    } finally {
      setRunning(false);
    }
  };

  return (
    <aside className="ai-panel" aria-label="AI note assistant">
      <header>
        <div>
          <Sparkles size={17} />
          <strong>Note assistant</strong>
        </div>
        <button onClick={onClose} aria-label="Close AI assistant">
          <X size={18} />
        </button>
      </header>
      <label className="profile-field">
        Routing profile
        <select
          value={profile}
          onChange={(event) => setProfile(event.target.value as AIProfile)}
        >
          <option value="default">Default</option>
          <option value="fast">Fast</option>
          <option value="deep">Deep</option>
          <option value="local">Local</option>
          <option value="agent">Agent</option>
        </select>
      </label>
      <div className="ai-actions">
        {actions.map((action) => {
          const Icon = action.icon;
          return (
            <button
              key={action.task}
              className={task === action.task ? "active" : ""}
              onClick={() => {
                setTask(action.task);
                if (action.task !== "ask-note") void run(action.task);
              }}
            >
              <Icon size={15} />
              {action.label}
            </button>
          );
        })}
      </div>
      {task === "ask-note" && (
        <form
          className="ask-form"
          onSubmit={(event) => {
            event.preventDefault();
            void run("ask-note");
          }}
        >
          <textarea
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            placeholder="What would you like to know?"
            aria-label="Question about this note"
          />
          <button disabled={!question.trim() || running}>Ask</button>
        </form>
      )}
      {!result && !error && !running && (
        <div className="ai-placeholder">
          <Sparkles size={24} />
          <p>
            Choose an action to work with this note. Content is sent only to the
            configured provider.
          </p>
        </div>
      )}
      {running && !result && (
        <div className="ai-placeholder">
          <div className="loading-ring" />
          <p>Thinking…</p>
        </div>
      )}
      {error && (
        <div className="ai-error">
          <strong>Assistant unavailable</strong>
          <p>{error}</p>
          <small>Configure OpenRouter in `.env` or start Ollama locally.</small>
        </div>
      )}
      {result && (
        <div className="ai-result">
          <div className="ai-result-label">Result</div>
          <p>{result}</p>
          {provenance && (
            <footer>Generated by {provenance} · source: this note</footer>
          )}
        </div>
      )}
    </aside>
  );
}
