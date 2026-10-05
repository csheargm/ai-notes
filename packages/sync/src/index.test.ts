import { createNote } from "@ai-notes/notes";
import { describe, expect, it, vi } from "vitest";
import { resolveNoteConflict, SyncClient } from "./index";

describe("sync", () => {
  it("resolves concurrent edits deterministically by timestamp", () => {
    const base = createNote({ title: "Note" }, "2026-01-01T00:00:00.000Z");
    const local = {
      ...base,
      revision: 3,
      updatedAt: "2026-01-03T00:00:00.000Z",
    };
    const remote = {
      ...base,
      revision: 4,
      updatedAt: "2026-01-02T00:00:00.000Z",
    };
    expect(resolveNoteConflict(local, remote).winner).toBe("local");
  });

  it("authenticates sync requests without putting tokens in URLs", async () => {
    const fetcher = vi.fn(
      async () =>
        new Response(
          JSON.stringify({ cursor: 1, changes: [], conflicts: [] }),
          { status: 200 },
        ),
    );
    const client = new SyncClient(
      "https://sync.example/",
      "secret",
      fetcher as typeof fetch,
    );
    await client.sync("device", 0, []);
    const call = fetcher.mock.calls[0] as unknown as [string, RequestInit];
    expect(call[0]).toBe("https://sync.example/api/sync");
    expect(call[1].headers).toMatchObject({ Authorization: "Bearer secret" });
  });
});
