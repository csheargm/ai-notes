import { describe, expect, it } from "vitest";
import {
  createNote,
  inkBlock,
  matchesNote,
  normalizeTags,
  noteText,
  sortNotes,
  updateNoteText,
  updateNoteInk,
  addSource,
  addReference,
  sources,
} from "./index";

describe("note domain", () => {
  it("creates a versioned block note", () => {
    const note = createNote(
      {
        title: "  Field notes  ",
        text: "An observation",
        tags: [" Research "],
      },
      "2026-01-01T00:00:00.000Z",
    );
    expect(note.title).toBe("Field notes");
    expect(noteText(note)).toBe("An observation");
    expect(note.tags).toEqual(["research"]);
    expect(note.revision).toBe(1);
  });

  it("normalizes and deduplicates tags", () => {
    expect(
      normalizeTags(["#Product Ideas", "product-ideas", "  ", "WORK"]),
    ).toEqual(["product-ideas", "work"]);
  });

  it("updates text without losing the note identity", () => {
    const note = createNote({ text: "Before" }, "2026-01-01T00:00:00.000Z");
    const updated = updateNoteText(note, "After", "2026-01-02T00:00:00.000Z");
    expect(updated.id).toBe(note.id);
    expect(noteText(updated)).toBe("After");
    expect(updated.revision).toBe(2);
  });

  it("matches all search terms across title, text, and tags", () => {
    const note = createNote({
      title: "Project Atlas",
      text: "Offline notebook",
      tags: ["research"],
    });
    expect(matchesNote(note, "atlas research")).toBe(true);
    expect(matchesNote(note, "atlas finance")).toBe(false);
  });

  it("orders pinned notes first and then by recency", () => {
    const older = {
      ...createNote({}, "2026-01-01T00:00:00.000Z"),
      updatedAt: "2026-01-01T00:00:00.000Z",
    };
    const newer = {
      ...createNote({}, "2026-01-02T00:00:00.000Z"),
      updatedAt: "2026-01-02T00:00:00.000Z",
    };
    expect(sortNotes([older, newer]).map((note) => note.id)).toEqual([
      newer.id,
      older.id,
    ]);
    expect(sortNotes([older, { ...newer, pinned: true }])[0]?.pinned).toBe(
      true,
    );
  });

  it("stores vector ink without changing searchable text", () => {
    const note = createNote({ text: "Typed context" });
    const updated = updateNoteInk(
      note,
      [
        {
          id: "stroke-1",
          tool: "pen",
          color: "#222",
          width: 3,
          points: [{ x: 1, y: 2, pressure: 0.7, timestamp: 10 }],
        },
      ],
      { width: 640, height: 320 },
    );
    expect(inkBlock(updated)?.strokes[0]?.points[0]?.pressure).toBe(0.7);
    expect(noteText(updated)).toBe("Typed context");
  });

  it("adds research sources and note references as typed blocks", () => {
    const note = addReference(
      addSource(createNote(), {
        kind: "url",
        title: "Paper",
        url: "https://example.com",
        annotations: [],
      }),
      "other",
      "Related note",
    );
    expect(sources(note)[0]?.url).toBe("https://example.com");
    expect(
      note.blocks.some(
        (block) => block.type === "reference" && block.noteId === "other",
      ),
    ).toBe(true);
  });
});
