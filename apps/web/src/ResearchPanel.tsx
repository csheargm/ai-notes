import {
  references,
  sources,
  type CanvasItem,
  type Note,
  type SourceBlock,
} from "@ai-notes/notes";
import { backlinks, relatedNotes } from "@ai-notes/research";
import { IndexedDbAttachmentRepository } from "@ai-notes/storage";
import {
  ExternalLink,
  FileUp,
  Image,
  Link2,
  Mic,
  Network,
  Plus,
  X,
} from "lucide-react";
import { useMemo, useRef, useState, type PointerEvent } from "react";

const attachments = new IndexedDbAttachmentRepository();

async function extractText(file: File): Promise<string> {
  if (file.type.startsWith("text/") || /\.(md|txt|csv|json)$/i.test(file.name))
    return file.text();
  if (file.type === "application/pdf") {
    const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
    const document = await pdfjs.getDocument({ data: await file.arrayBuffer() })
      .promise;
    const pages: string[] = [];
    for (let index = 1; index <= document.numPages; index += 1) {
      const content = await (await document.getPage(index)).getTextContent();
      pages.push(
        content.items.map((item) => ("str" in item ? item.str : "")).join(" "),
      );
    }
    return pages.join("\n\n");
  }
  if (file.type.startsWith("image/") && "TextDetector" in globalThis) {
    const bitmap = await createImageBitmap(file);
    const Detector = (
      globalThis as unknown as {
        TextDetector: new () => {
          detect: (image: ImageBitmap) => Promise<Array<{ rawValue: string }>>;
        };
      }
    ).TextDetector;
    return (await new Detector().detect(bitmap))
      .map((item) => item.rawValue)
      .join("\n");
  }
  if (file.type.startsWith("image/")) {
    const { createWorker } = await import("tesseract.js");
    const worker = await createWorker("eng");
    try {
      return (await worker.recognize(file)).data.text;
    } finally {
      await worker.terminate();
    }
  }
  return "";
}

function kindFor(file: File): SourceBlock["kind"] {
  if (file.type === "application/pdf") return "pdf";
  if (file.type.startsWith("image/")) return "image";
  if (file.type.startsWith("audio/")) return "audio";
  return "file";
}

function CanvasBoard({
  note,
  items,
  onChange,
}: {
  note: Note;
  items: CanvasItem[];
  onChange: (items: CanvasItem[]) => void;
}) {
  const board = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<{
    id: string;
    offsetX: number;
    offsetY: number;
  }>();
  const available = [
    ...sources(note).map((source) => ({
      id: `source-${source.id}`,
      label: source.title,
      sourceBlockId: source.id,
    })),
    ...references(note).map((reference) => ({
      id: `note-${reference.noteId}`,
      label: reference.label,
      noteId: reference.noteId,
    })),
  ].filter((candidate) => !items.some((item) => item.id === candidate.id));

  const start = (event: PointerEvent<HTMLButtonElement>, item: CanvasItem) => {
    const rect = event.currentTarget.getBoundingClientRect();
    event.currentTarget.setPointerCapture(event.pointerId);
    setDrag({
      id: item.id,
      offsetX: event.clientX - rect.left,
      offsetY: event.clientY - rect.top,
    });
  };
  const move = (event: PointerEvent<HTMLDivElement>) => {
    if (!drag || !board.current) return;
    const rect = board.current.getBoundingClientRect();
    const x = Math.max(
      0,
      Math.min(
        1020,
        ((event.clientX - rect.left - drag.offsetX) / rect.width) * 1200,
      ),
    );
    const y = Math.max(
      0,
      Math.min(
        590,
        ((event.clientY - rect.top - drag.offsetY) / rect.height) * 700,
      ),
    );
    onChange(
      items.map((item) => (item.id === drag.id ? { ...item, x, y } : item)),
    );
  };

  return (
    <section className="research-canvas">
      <div className="canvas-heading">
        <span>
          <Network size={15} /> Spatial board
        </span>
        {available.length > 0 && (
          <button
            onClick={() => {
              const candidate = available[0]!;
              onChange([
                ...items,
                {
                  ...candidate,
                  x: 35 + items.length * 28,
                  y: 35 + items.length * 24,
                  color: ["#e2efe9", "#f4e8d7", "#e8e4f3"][items.length % 3]!,
                },
              ]);
            }}
          >
            <Plus size={14} /> Add {available[0]!.label}
          </button>
        )}
      </div>
      <div
        ref={board}
        className="canvas-board"
        onPointerMove={move}
        onPointerUp={() => setDrag(undefined)}
        onPointerCancel={() => setDrag(undefined)}
      >
        {items.map((item) => (
          <button
            key={item.id}
            style={{
              left: `${(item.x / 1200) * 100}%`,
              top: `${(item.y / 700) * 100}%`,
              background: item.color,
            }}
            onPointerDown={(event) => start(event, item)}
          >
            {item.label}
          </button>
        ))}
        {!items.length && (
          <p>
            Add captured sources or linked notes, then drag them into a spatial
            layout.
          </p>
        )}
      </div>
    </section>
  );
}

export function ResearchPanel({
  note,
  notes,
  onSource,
  onEditSource,
  onLink,
  canvasItems,
  onCanvas,
  onClose,
}: {
  note: Note;
  notes: Note[];
  onSource: (source: Omit<SourceBlock, "id" | "type" | "createdAt">) => void;
  onEditSource: (
    id: string,
    changes: Partial<Omit<SourceBlock, "id" | "type">>,
  ) => void;
  onLink: (id: string, label: string) => void;
  canvasItems: CanvasItem[];
  onCanvas: (items: CanvasItem[]) => void;
  onClose: () => void;
}) {
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const related = useMemo(() => relatedNotes(note, notes), [note, notes]);
  const incoming = useMemo(() => backlinks(note.id, notes), [note.id, notes]);

  const captureUrl = () => {
    try {
      const parsed = new URL(url);
      onSource({
        kind: "url",
        title: parsed.hostname,
        url: parsed.toString(),
        annotations: [],
      });
      setUrl("");
    } catch {
      /* Keep invalid input for correction. */
    }
  };

  const upload = async (file: File) => {
    setBusy(true);
    try {
      const stored = await attachments.save(file);
      const extractedText = await extractText(file).catch(() => "");
      onSource({
        kind: kindFor(file),
        title: file.name,
        attachmentId: stored.id,
        mimeType: stored.mimeType,
        size: stored.size,
        extractedText,
        annotations: [],
      });
    } finally {
      setBusy(false);
    }
  };

  const openAttachment = async (source: SourceBlock) => {
    if (!source.attachmentId) return;
    let attachment = await attachments.get(source.attachmentId);
    if (!attachment) {
      const baseUrl = localStorage
        .getItem("ai-notes-sync-url")
        ?.replace(/\/$/, "");
      const token = sessionStorage.getItem("ai-notes-sync-token");
      if (!baseUrl || !token) return;
      const response = await fetch(
        `${baseUrl}/api/attachments/${source.attachmentId}`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      if (!response.ok) return;
      attachment = await attachments.saveBlob(
        source.attachmentId,
        await response.blob(),
        source.title,
        source.mimeType,
      );
    }
    const objectUrl = URL.createObjectURL(attachment.blob);
    const anchor = document.createElement("a");
    anchor.href = objectUrl;
    anchor.target = "_blank";
    anchor.rel = "noopener";
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
  };

  return (
    <aside className="research-panel" aria-label="Research workspace">
      <header>
        <div>
          <Network size={17} />
          <strong>Research</strong>
        </div>
        <button onClick={onClose} aria-label="Close research workspace">
          <X size={18} />
        </button>
      </header>
      <div className="capture-row">
        <input
          value={url}
          onChange={(event) => setUrl(event.target.value)}
          placeholder="Paste a source URL"
          aria-label="Source URL"
        />
        <button onClick={captureUrl} disabled={!url}>
          <Link2 size={15} />
        </button>
      </div>
      <label className="file-capture">
        <FileUp size={15} />
        {busy ? "Extracting…" : "Capture PDF, image, audio, or file"}
        <input
          type="file"
          disabled={busy}
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void upload(file);
          }}
        />
      </label>
      <section>
        <h3>Sources</h3>
        {sources(note).map((source) => (
          <article className="source-card" key={source.id}>
            <div>
              {source.kind === "image" ? (
                <Image size={15} />
              ) : source.kind === "audio" ? (
                <Mic size={15} />
              ) : (
                <ExternalLink size={15} />
              )}
              <strong>{source.title}</strong>
            </div>
            {source.url && (
              <a href={source.url} target="_blank" rel="noreferrer">
                Open source
              </a>
            )}
            {source.attachmentId && (
              <button
                className="open-attachment"
                onClick={() => void openAttachment(source)}
              >
                Open attachment
              </button>
            )}
            {source.extractedText && (
              <details>
                <summary>Extracted text</summary>
                <p>{source.extractedText.slice(0, 2000)}</p>
              </details>
            )}
            <textarea
              value={source.annotations.join("\n")}
              onChange={(event) =>
                onEditSource(source.id, {
                  annotations: event.target.value.split("\n").filter(Boolean),
                })
              }
              placeholder="Add highlights or annotations, one per line"
              aria-label={`Annotations for ${source.title}`}
            />
          </article>
        ))}
        {!sources(note).length && (
          <p className="research-empty">
            Capture a source to keep evidence beside your notes.
          </p>
        )}
      </section>
      <section>
        <h3>Links and discovery</h3>
        <select
          defaultValue=""
          onChange={(event) => {
            const target = notes.find((item) => item.id === event.target.value);
            if (target) onLink(target.id, target.title);
            event.currentTarget.value = "";
          }}
        >
          <option value="">Link another note…</option>
          {notes
            .filter((item) => item.id !== note.id)
            .map((item) => (
              <option key={item.id} value={item.id}>
                {item.title}
              </option>
            ))}
        </select>
        {references(note).map((reference) => (
          <div className="related-row" key={reference.id}>
            Linked → {reference.label}
          </div>
        ))}
        {incoming.map((item) => (
          <div className="related-row" key={item.id}>
            Backlink ← {item.title}
          </div>
        ))}
        {related.map((item) => (
          <div className="related-row" key={item.note.id}>
            Related · {item.note.title}{" "}
            <small>{Math.round(item.score * 100)}%</small>
          </div>
        ))}
      </section>
      <CanvasBoard note={note} items={canvasItems} onChange={onCanvas} />
    </aside>
  );
}
