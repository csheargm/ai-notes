import type { Note } from "@ai-notes/notes";
import { openDB, type DBSchema, type IDBPDatabase } from "idb";

export interface NoteRepository {
  list(): Promise<Note[]>;
  get(id: string): Promise<Note | undefined>;
  save(note: Note): Promise<void>;
  delete(id: string): Promise<void>;
  count(): Promise<number>;
}

interface NotesDatabase extends DBSchema {
  notes: {
    key: string;
    value: Note;
    indexes: { "by-updated": string };
  };
}

export class IndexedDbNoteRepository implements NoteRepository {
  private database?: Promise<IDBPDatabase<NotesDatabase>>;

  constructor(private readonly databaseName = "ai-notes") {}

  private db(): Promise<IDBPDatabase<NotesDatabase>> {
    this.database ??= openDB<NotesDatabase>(this.databaseName, 1, {
      upgrade(database) {
        const notes = database.createObjectStore("notes", { keyPath: "id" });
        notes.createIndex("by-updated", "updatedAt");
      },
    });
    return this.database;
  }

  async list(): Promise<Note[]> {
    return (await this.db()).getAllFromIndex("notes", "by-updated");
  }

  async get(id: string): Promise<Note | undefined> {
    return (await this.db()).get("notes", id);
  }

  async save(note: Note): Promise<void> {
    await (await this.db()).put("notes", note);
  }

  async delete(id: string): Promise<void> {
    await (await this.db()).delete("notes", id);
  }

  async count(): Promise<number> {
    return (await this.db()).count("notes");
  }

  async close(): Promise<void> {
    if (!this.database) return;
    (await this.database).close();
    this.database = undefined;
  }
}
