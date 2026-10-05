import type { Note } from "@ai-notes/notes";

export type SyncChange = {
  sequence?: number;
  deviceId: string;
  operation: "upsert" | "delete";
  noteId: string;
  note?: Note;
  baseRevision?: number;
  changedAt: string;
};

export type SyncConflict = {
  noteId: string;
  local: Note;
  remote: Note;
  winner: "local" | "remote";
};

export type SyncResult = {
  cursor: number;
  changes: SyncChange[];
  conflicts: SyncConflict[];
};

export function resolveNoteConflict(local: Note, remote: Note): SyncConflict {
  const winner =
    local.updatedAt > remote.updatedAt ||
    (local.updatedAt === remote.updatedAt && local.revision >= remote.revision)
      ? "local"
      : "remote";
  return { noteId: local.id, local, remote, winner };
}

export class SyncClient {
  constructor(
    private readonly baseUrl: string,
    private readonly token: string,
    private readonly fetcher: typeof fetch = fetch,
  ) {}

  async sync(
    deviceId: string,
    cursor: number,
    changes: SyncChange[],
  ): Promise<SyncResult> {
    const response = await this.fetcher(
      `${this.baseUrl.replace(/\/$/, "")}/api/sync`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ deviceId, cursor, changes }),
      },
    );
    if (!response.ok) {
      const data = (await response.json().catch(() => ({}))) as {
        error?: string;
      };
      throw new Error(data.error ?? `Sync failed (${response.status}).`);
    }
    return response.json() as Promise<SyncResult>;
  }
}
