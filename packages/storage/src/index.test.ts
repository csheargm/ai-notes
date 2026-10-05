import "fake-indexeddb/auto";
import { createNote } from "@ai-notes/notes";
import { afterEach, describe, expect, it } from "vitest";
import { IndexedDbNoteRepository } from "./index";

const databases: string[] = [];
const repositories: IndexedDbNoteRepository[] = [];

afterEach(async () => {
  await Promise.all(
    repositories.splice(0).map((repository) => repository.close()),
  );
  await Promise.all(
    databases.splice(0).map(
      (name) =>
        new Promise<void>((resolve, reject) => {
          const request = indexedDB.deleteDatabase(name);
          request.onsuccess = () => resolve();
          request.onerror = () => reject(request.error);
        }),
    ),
  );
});

describe("IndexedDbNoteRepository", () => {
  it("persists, lists, reads, and deletes notes", async () => {
    const name = `test-notes-${crypto.randomUUID()}`;
    databases.push(name);
    const repository = new IndexedDbNoteRepository(name);
    repositories.push(repository);
    const note = createNote({ title: "Stored" });

    await repository.save(note);
    expect(await repository.count()).toBe(1);
    expect((await repository.get(note.id))?.title).toBe("Stored");
    expect(await repository.list()).toHaveLength(1);

    await repository.delete(note.id);
    expect(await repository.count()).toBe(0);
  });
});
