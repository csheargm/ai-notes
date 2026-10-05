import { addReference, createNote } from "@ai-notes/notes";
import { describe, expect, it } from "vitest";
import { backlinks, relatedNotes } from "./index";

describe("research discovery", () => {
  it("finds conceptually related notes with expanded local terms", () => {
    const target = createNote({
      title: "AI systems",
      text: "language model research",
    });
    const related = createNote({
      title: "Paper review",
      text: "artificial intelligence evidence",
    });
    const unrelated = createNote({ title: "Groceries", text: "milk" });
    expect(relatedNotes(target, [target, unrelated, related])[0]?.note.id).toBe(
      related.id,
    );
  });

  it("derives backlinks from note references", () => {
    const target = createNote({ title: "Target" });
    const linking = addReference(
      createNote({ title: "Linking" }),
      target.id,
      target.title,
    );
    expect(
      backlinks(target.id, [target, linking]).map((note) => note.id),
    ).toEqual([linking.id]);
  });
});
