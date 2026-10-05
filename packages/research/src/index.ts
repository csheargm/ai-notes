import { noteText, references, sources, type Note } from "@ai-notes/notes";

const synonyms: Record<string, string[]> = {
  ai: ["artificial", "intelligence", "model", "llm"],
  todo: ["action", "task", "next"],
  research: ["paper", "source", "study", "evidence"],
  meeting: ["agenda", "minutes", "discussion"],
};

function tokens(text: string): string[] {
  const base = text.toLowerCase().match(/[\p{L}\p{N}]{2,}/gu) ?? [];
  return [...base, ...base.flatMap((token) => synonyms[token] ?? [])];
}

function vector(text: string): Map<string, number> {
  const result = new Map<string, number>();
  for (const token of tokens(text))
    result.set(token, (result.get(token) ?? 0) + 1);
  return result;
}

function cosine(left: Map<string, number>, right: Map<string, number>): number {
  let dot = 0;
  let leftNorm = 0;
  let rightNorm = 0;
  for (const value of left.values()) leftNorm += value * value;
  for (const [key, value] of right) {
    rightNorm += value * value;
    dot += value * (left.get(key) ?? 0);
  }
  return leftNorm && rightNorm ? dot / Math.sqrt(leftNorm * rightNorm) : 0;
}

export function searchableText(note: Note): string {
  return [
    note.title,
    noteText(note),
    ...note.tags,
    ...sources(note).flatMap((source) => [
      source.title,
      source.extractedText ?? "",
      ...source.annotations,
    ]),
  ].join(" ");
}

export function relatedNotes(
  target: Note,
  notes: Note[],
  limit = 5,
): Array<{ note: Note; score: number }> {
  const targetVector = vector(searchableText(target));
  return notes
    .filter((note) => note.id !== target.id)
    .map((note) => ({
      note,
      score: cosine(targetVector, vector(searchableText(note))),
    }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

export function backlinks(targetId: string, notes: Note[]): Note[] {
  return notes.filter((note) =>
    references(note).some((reference) => reference.noteId === targetId),
  );
}
