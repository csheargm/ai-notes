import { sources, type Note } from "@ai-notes/notes";
import { IndexedDbAttachmentRepository } from "@ai-notes/storage";
import { SyncClient, type SyncChange } from "@ai-notes/sync";
import { Cloud, RefreshCw, ShieldCheck, X } from "lucide-react";
import { useState } from "react";

const deviceId =
  localStorage.getItem("ai-notes-device-id") ?? crypto.randomUUID();
localStorage.setItem("ai-notes-device-id", deviceId);
const attachmentRepository = new IndexedDbAttachmentRepository();

export function SyncPanel({
  notes,
  deletedIds,
  onApply,
  onSynced,
  onClose,
}: {
  notes: Note[];
  deletedIds: string[];
  onApply: (changes: SyncChange[]) => Promise<void>;
  onSynced: (deletedIds: string[]) => void;
  onClose: () => void;
}) {
  const [baseUrl, setBaseUrl] = useState(
    localStorage.getItem("ai-notes-sync-url") ?? "",
  );
  const [token, setToken] = useState(
    sessionStorage.getItem("ai-notes-sync-token") ?? "",
  );
  const [status, setStatus] = useState("");
  const [running, setRunning] = useState(false);

  const sync = async () => {
    if (!baseUrl || !token) return;
    setRunning(true);
    setStatus("Connecting…");
    try {
      localStorage.setItem("ai-notes-sync-url", baseUrl);
      sessionStorage.setItem("ai-notes-sync-token", token);
      const uploaded = new Set(
        JSON.parse(
          localStorage.getItem("ai-notes-uploaded-attachments") ?? "[]",
        ) as string[],
      );
      for (const source of notes.flatMap(sources)) {
        if (!source.attachmentId || uploaded.has(source.attachmentId)) continue;
        const attachment = await attachmentRepository.get(source.attachmentId);
        if (!attachment) continue;
        const bytes = new Uint8Array(await attachment.blob.arrayBuffer());
        let binary = "";
        for (let offset = 0; offset < bytes.length; offset += 0x8000)
          binary += String.fromCharCode(
            ...bytes.subarray(offset, offset + 0x8000),
          );
        const upload = await fetch(
          `${baseUrl.replace(/\/$/, "")}/api/attachments/${source.attachmentId}`,
          {
            method: "PUT",
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              data: btoa(binary),
              contentType: attachment.mimeType,
              name: attachment.name,
            }),
          },
        );
        if (!upload.ok)
          throw new Error(`Could not upload attachment ${attachment.name}.`);
        uploaded.add(source.attachmentId);
      }
      localStorage.setItem(
        "ai-notes-uploaded-attachments",
        JSON.stringify([...uploaded]),
      );
      const cursor = Number(localStorage.getItem("ai-notes-sync-cursor") ?? 0);
      const revisions = JSON.parse(
        localStorage.getItem("ai-notes-sync-revisions") ?? "{}",
      ) as Record<string, number>;
      const changes: SyncChange[] = notes
        .filter((note) => revisions[note.id] !== note.revision)
        .map((note) => ({
          deviceId,
          operation: "upsert",
          noteId: note.id,
          note,
          baseRevision: revisions[note.id],
          changedAt: note.updatedAt,
        }));
      changes.push(
        ...deletedIds.map((noteId) => ({
          deviceId,
          operation: "delete" as const,
          noteId,
          baseRevision: revisions[noteId],
          changedAt: new Date().toISOString(),
        })),
      );
      const result = await new SyncClient(baseUrl, token).sync(
        deviceId,
        cursor,
        changes,
      );
      await onApply(
        result.changes.filter(
          (change) =>
            change.deviceId !== deviceId ||
            !changes.some(
              (local) =>
                local.noteId === change.noteId &&
                local.changedAt === change.changedAt,
            ),
        ),
      );
      const nextRevisions = { ...revisions };
      for (const change of result.changes) {
        if (change.operation === "delete") delete nextRevisions[change.noteId];
        else if (change.note)
          nextRevisions[change.noteId] = change.note.revision;
      }
      localStorage.setItem("ai-notes-sync-cursor", String(result.cursor));
      localStorage.setItem(
        "ai-notes-sync-revisions",
        JSON.stringify(nextRevisions),
      );
      onSynced(deletedIds);
      setStatus(
        `Synced at ${new Date().toLocaleTimeString()}${result.conflicts.length ? ` · ${result.conflicts.length} conflict${result.conflicts.length === 1 ? "" : "s"} resolved` : ""}`,
      );
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Sync failed.");
    } finally {
      setRunning(false);
    }
  };

  return (
    <aside className="sync-panel" aria-label="Cloud synchronization">
      <header>
        <div>
          <Cloud size={17} />
          <strong>Sync</strong>
        </div>
        <button onClick={onClose} aria-label="Close sync settings">
          <X size={18} />
        </button>
      </header>
      <p>
        Connect this notebook to an AI Notes server. Notes remain local-first
        and synchronize through an authenticated change feed.
      </p>
      <label>
        Server URL
        <input
          value={baseUrl}
          onChange={(event) => setBaseUrl(event.target.value)}
          placeholder="https://notes.example.com"
        />
      </label>
      <label>
        Access token
        <input
          type="password"
          value={token}
          onChange={(event) => setToken(event.target.value)}
          placeholder="Sync token"
        />
      </label>
      <button
        className="sync-action"
        disabled={!baseUrl || !token || running}
        onClick={() => void sync()}
      >
        <RefreshCw size={16} className={running ? "spinning" : ""} />
        {running ? "Synchronizing…" : "Sync now"}
      </button>
      {status && (
        <div className="sync-status" role="status">
          {status}
        </div>
      )}
      <div className="sync-security">
        <ShieldCheck size={16} />
        <span>
          The token is held only for this browser session. Attachments and
          history are stored by your configured server.
        </span>
      </div>
    </aside>
  );
}
