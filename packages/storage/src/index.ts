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
  attachments: {
    key: string;
    value: {
      id: string;
      blob: Blob;
      name: string;
      mimeType: string;
      size: number;
      createdAt: string;
    };
  };
}

export class IndexedDbNoteRepository implements NoteRepository {
  private database?: Promise<IDBPDatabase<NotesDatabase>>;

  constructor(private readonly databaseName = "ai-notes") {}

  private db(): Promise<IDBPDatabase<NotesDatabase>> {
    this.database ??= openDB<NotesDatabase>(this.databaseName, 2, {
      upgrade(database, oldVersion) {
        if (oldVersion < 1) {
          const notes = database.createObjectStore("notes", { keyPath: "id" });
          notes.createIndex("by-updated", "updatedAt");
        }
        if (oldVersion < 2)
          database.createObjectStore("attachments", { keyPath: "id" });
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

export class IndexedDbAttachmentRepository {
  private database?: Promise<IDBPDatabase<NotesDatabase>>;
  constructor(private readonly databaseName = "ai-notes") {}
  private db() {
    this.database ??= openDB<NotesDatabase>(this.databaseName, 2, {
      upgrade(database, oldVersion) {
        if (oldVersion < 1) {
          const notes = database.createObjectStore("notes", { keyPath: "id" });
          notes.createIndex("by-updated", "updatedAt");
        }
        if (oldVersion < 2)
          database.createObjectStore("attachments", { keyPath: "id" });
      },
    });
    return this.database;
  }
  async save(file: File) {
    return this.saveBlob(
      crypto.randomUUID(),
      file.slice(),
      file.name,
      file.type || "application/octet-stream",
    );
  }
  async saveBlob(
    id: string,
    blob: Blob,
    name: string,
    mimeType = blob.type || "application/octet-stream",
  ) {
    const value = {
      id,
      blob,
      name,
      mimeType,
      size: blob.size,
      createdAt: new Date().toISOString(),
    };
    await (await this.db()).put("attachments", value);
    return value;
  }
  async get(id: string) {
    return (await this.db()).get("attachments", id);
  }
  async delete(id: string) {
    await (await this.db()).delete("attachments", id);
  }
  async close(): Promise<void> {
    if (!this.database) return;
    (await this.database).close();
    this.database = undefined;
  }
}
