import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createNote } from "@ai-notes/notes";
import { afterEach, describe, expect, it } from "vitest";
import { FileSyncStore } from "./sync-store.js";

const roots: string[] = [];
afterEach(async () =>
  Promise.all(
    roots.splice(0).map((root) => rm(root, { recursive: true, force: true })),
  ),
);

describe("FileSyncStore", () => {
  it("persists a sequenced change feed and version history", async () => {
    const root = await mkdtemp(join(tmpdir(), "ai-notes-sync-"));
    roots.push(root);
    const store = new FileSyncStore(root);
    const note = createNote({ title: "First" });
    const first = await store.sync("user", 0, [
      {
        deviceId: "a",
        operation: "upsert",
        noteId: note.id,
        note,
        changedAt: note.updatedAt,
      },
    ]);
    const edited = {
      ...note,
      title: "Second",
      revision: 2,
      updatedAt: "2026-02-01T00:00:00.000Z",
    };
    const second = await store.sync("user", first.cursor, [
      {
        deviceId: "a",
        operation: "upsert",
        noteId: note.id,
        note: edited,
        baseRevision: 1,
        changedAt: edited.updatedAt,
      },
    ]);
    expect(second.cursor).toBe(2);
    expect((await store.history("user", note.id))[0]?.title).toBe("First");
  });
});
