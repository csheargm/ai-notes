import { createId, nowIso, type ISODateString } from "@ai-notes/shared";

export type TextBlock = {
  id: string;
  type: "text";
  text: string;
};

export type InkTool = "pen" | "highlighter" | "eraser" | "select";

export type InkPoint = {
  x: number;
  y: number;
  pressure: number;
  timestamp: number;
};

export type InkStroke = {
  id: string;
  tool: Exclude<InkTool, "eraser">;
  color: string;
  width: number;
  points: InkPoint[];
};

export type InkBlock = {
  id: string;
  type: "ink";
  width: number;
  height: number;
  strokes: InkStroke[];
};

export type SourceKind = "url" | "pdf" | "image" | "audio" | "file";

export type SourceBlock = {
  id: string;
  type: "source";
  kind: SourceKind;
  title: string;
  url?: string;
  attachmentId?: string;
  mimeType?: string;
  size?: number;
  extractedText?: string;
  annotations: string[];
  createdAt: ISODateString;
};

export type ReferenceBlock = {
  id: string;
  type: "reference";
  noteId: string;
  label: string;
};

export type CanvasItem = {
  id: string;
  label: string;
  x: number;
  y: number;
  color: string;
  sourceBlockId?: string;
  noteId?: string;
};

export type CanvasBlock = {
  id: string;
  type: "canvas";
  width: number;
  height: number;
  items: CanvasItem[];
};

export type NoteBlock =
  TextBlock | InkBlock | SourceBlock | ReferenceBlock | CanvasBlock;

export type Note = {
  id: string;
  title: string;
  blocks: NoteBlock[];
  tags: string[];
  pinned: boolean;
  createdAt: ISODateString;
  updatedAt: ISODateString;
  revision: number;
};

export type CreateNoteInput = {
  title?: string;
  text?: string;
  tags?: string[];
};

export function normalizeTag(tag: string): string {
  return tag.trim().replace(/^#+/, "").replace(/\s+/g, "-").toLowerCase();
}

export function normalizeTags(tags: string[]): string[] {
  return [...new Set(tags.map(normalizeTag).filter(Boolean))].slice(0, 20);
}

export function createNote(
  input: CreateNoteInput = {},
  timestamp = nowIso(),
): Note {
  return {
    id: createId("note"),
    title: input.title?.trim() || "Untitled note",
    blocks: [{ id: createId("block"), type: "text", text: input.text ?? "" }],
    tags: normalizeTags(input.tags ?? []),
    pinned: false,
    createdAt: timestamp,
    updatedAt: timestamp,
    revision: 1,
  };
}

export function noteText(note: Note): string {
  return note.blocks
    .filter((block): block is TextBlock => block.type === "text")
    .map((block) => block.text)
    .join("\n\n");
}

export function updateNote(
  note: Note,
  changes: Partial<Pick<Note, "title" | "blocks" | "tags" | "pinned">>,
  timestamp = nowIso(),
): Note {
  return {
    ...note,
    ...changes,
    title: changes.title === undefined ? note.title : changes.title,
    tags: changes.tags === undefined ? note.tags : normalizeTags(changes.tags),
    updatedAt: timestamp,
    revision: note.revision + 1,
  };
}

export function updateNoteText(
  note: Note,
  text: string,
  timestamp = nowIso(),
): Note {
  const firstText = note.blocks.find((block) => block.type === "text");
  const blocks: NoteBlock[] = firstText
    ? note.blocks.map((block) =>
        block.id === firstText.id ? { ...block, text } : block,
      )
    : [{ id: createId("block"), type: "text", text }];
  return updateNote(note, { blocks }, timestamp);
}

export function inkBlock(note: Note): InkBlock | undefined {
  return note.blocks.find((block): block is InkBlock => block.type === "ink");
}

export function updateNoteInk(
  note: Note,
  strokes: InkStroke[],
  size: { width: number; height: number },
  timestamp = nowIso(),
): Note {
  const current = inkBlock(note);
  const next: InkBlock = {
    id: current?.id ?? createId("block"),
    type: "ink",
    width: size.width,
    height: size.height,
    strokes,
  };
  const blocks = current
    ? note.blocks.map((block) => (block.id === current.id ? next : block))
    : [...note.blocks, next];
  return updateNote(note, { blocks }, timestamp);
}

export function addSource(
  note: Note,
  source: Omit<SourceBlock, "id" | "type" | "createdAt">,
  timestamp = nowIso(),
): Note {
  return updateNote(
    note,
    {
      blocks: [
        ...note.blocks,
        {
          ...source,
          id: createId("source"),
          type: "source",
          createdAt: timestamp,
        },
      ],
    },
    timestamp,
  );
}

export function updateSource(
  note: Note,
  sourceId: string,
  changes: Partial<Omit<SourceBlock, "id" | "type">>,
  timestamp = nowIso(),
): Note {
  return updateNote(
    note,
    {
      blocks: note.blocks.map((block) =>
        block.id === sourceId && block.type === "source"
          ? { ...block, ...changes }
          : block,
      ),
    },
    timestamp,
  );
}

export function addReference(
  note: Note,
  noteId: string,
  label: string,
  timestamp = nowIso(),
): Note {
  if (
    note.blocks.some(
      (block) => block.type === "reference" && block.noteId === noteId,
    )
  )
    return note;
  return updateNote(
    note,
    {
      blocks: [
        ...note.blocks,
        { id: createId("reference"), type: "reference", noteId, label },
      ],
    },
    timestamp,
  );
}

export function sources(note: Note): SourceBlock[] {
  return note.blocks.filter(
    (block): block is SourceBlock => block.type === "source",
  );
}

export function references(note: Note): ReferenceBlock[] {
  return note.blocks.filter(
    (block): block is ReferenceBlock => block.type === "reference",
  );
}

export function updateCanvas(
  note: Note,
  items: CanvasItem[],
  timestamp = nowIso(),
): Note {
  const current = note.blocks.find(
    (block): block is CanvasBlock => block.type === "canvas",
  );
  const next: CanvasBlock = {
    id: current?.id ?? createId("canvas"),
    type: "canvas",
    width: 1200,
    height: 700,
    items,
  };
  return updateNote(
    note,
    {
      blocks: current
        ? note.blocks.map((block) => (block.id === current.id ? next : block))
        : [...note.blocks, next],
    },
    timestamp,
  );
}

export function matchesNote(note: Note, rawQuery: string): boolean {
  const query = rawQuery.trim().toLocaleLowerCase();
  if (!query) return true;
  const haystack = [note.title, noteText(note), ...note.tags]
    .join(" ")
    .toLocaleLowerCase();
  return query.split(/\s+/).every((term) => haystack.includes(term));
}

export function sortNotes(notes: Note[]): Note[] {
  return [...notes].sort((left, right) => {
    if (left.pinned !== right.pinned) return left.pinned ? -1 : 1;
    return right.updatedAt.localeCompare(left.updatedAt);
  });
}
