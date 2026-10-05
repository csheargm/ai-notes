import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { Note } from "@ai-notes/notes";
import {
  resolveNoteConflict,
  type SyncChange,
  type SyncConflict,
  type SyncResult,
} from "@ai-notes/sync";

type UserState = {
  cursor: number;
  notes: Record<string, Note>;
  deleted: Record<string, string>;
  changes: SyncChange[];
  history: Record<string, Note[]>;
};

const emptyState = (): UserState => ({
  cursor: 0,
  notes: {},
  deleted: {},
  changes: [],
  history: {},
});

export class FileSyncStore {
  constructor(private readonly root: string) {}

  private path(userId: string) {
    return join(this.root, `${userId.replace(/[^a-zA-Z0-9_-]/g, "_")}.json`);
  }

  private async read(userId: string): Promise<UserState> {
    try {
      return JSON.parse(await readFile(this.path(userId), "utf8")) as UserState;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT")
        return emptyState();
      throw error;
    }
  }

  private async write(userId: string, state: UserState) {
    await mkdir(this.root, { recursive: true });
    const target = this.path(userId);
    const temporary = `${target}.${process.pid}.tmp`;
    await writeFile(temporary, JSON.stringify(state), { mode: 0o600 });
    await rename(temporary, target);
  }

  async sync(
    userId: string,
    cursor: number,
    incoming: SyncChange[],
  ): Promise<SyncResult> {
    const state = await this.read(userId);
    const conflicts: SyncConflict[] = [];

    for (const change of incoming) {
      const remote = state.notes[change.noteId];
      if (change.operation === "delete") {
        if (
          remote &&
          change.baseRevision !== undefined &&
          remote.revision !== change.baseRevision
        )
          continue;
        delete state.notes[change.noteId];
        state.deleted[change.noteId] = change.changedAt;
      } else if (change.note) {
        let accepted = change.note;
        if (
          remote &&
          change.baseRevision !== undefined &&
          remote.revision !== change.baseRevision
        ) {
          const conflict = resolveNoteConflict(change.note, remote);
          conflicts.push(conflict);
          accepted = conflict.winner === "local" ? change.note : remote;
        }
        if (accepted !== remote) {
          if (remote)
            state.history[remote.id] = [
              ...(state.history[remote.id] ?? []),
              remote,
            ].slice(-50);
          state.notes[accepted.id] = accepted;
          delete state.deleted[accepted.id];
        }
      }
      state.cursor += 1;
      state.changes.push({
        ...change,
        sequence: state.cursor,
        note:
          change.operation === "upsert"
            ? state.notes[change.noteId]
            : undefined,
      });
    }

    state.changes = state.changes.slice(-5000);
    await this.write(userId, state);
    return {
      cursor: state.cursor,
      changes: state.changes.filter(
        (change) => (change.sequence ?? 0) > cursor,
      ),
      conflicts,
    };
  }

  async history(userId: string, noteId: string): Promise<Note[]> {
    return (await this.read(userId)).history[noteId] ?? [];
  }
}
