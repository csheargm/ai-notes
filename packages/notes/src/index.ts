import { createId, nowIso, type ISODateString } from "@ai-notes/shared";

export type TextBlock = {
  id: string;
  type: "text";
  text: string;
};

export type NoteBlock = TextBlock;

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
  return note.blocks.map((block) => block.text).join("\n\n");
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
