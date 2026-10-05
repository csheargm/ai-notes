import {
  createServer,
  type IncomingMessage,
  type ServerResponse,
} from "node:http";
import { createHash, timingSafeEqual } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { loadEnvFile } from "node:process";
import { AIRouter, type AIRequest } from "@ai-notes/ai";
import { OllamaProvider, OpenRouterProvider } from "./providers.js";
import { FileSyncStore } from "./sync-store.js";

try {
  loadEnvFile();
} catch {
  // Environment variables can also be supplied by the shell or deployment host.
}

const port = Number(process.env.AI_NOTES_SERVER_PORT ?? 8787);
const dataRoot = process.env.AI_NOTES_DATA_DIR ?? ".data";
const syncToken = process.env.AI_NOTES_SYNC_TOKEN;
const syncStore = new FileSyncStore(join(dataRoot, "users"));
const openRouter = new OpenRouterProvider(process.env.OPENROUTER_API_KEY, {
  default: process.env.OPENROUTER_DEFAULT_MODEL,
  fast: process.env.OPENROUTER_FAST_MODEL,
  deep: process.env.OPENROUTER_DEEP_MODEL,
});
const ollama = new OllamaProvider(
  process.env.OLLAMA_BASE_URL,
  process.env.OLLAMA_MODEL,
);
const router = new AIRouter([ollama, openRouter]);

function json(response: ServerResponse, status: number, body: unknown) {
  response.writeHead(status, {
    "Content-Type": "application/json",
    "Cache-Control": "no-store",
  });
  response.end(JSON.stringify(body));
}

async function body(request: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of request) {
    const value = Buffer.from(chunk);
    size += value.length;
    if (size > 14_000_000) throw new Error("Request is too large.");
    chunks.push(value);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

function authenticate(request: IncomingMessage): string | undefined {
  if (!syncToken) return undefined;
  const supplied =
    request.headers.authorization?.replace(/^Bearer\s+/i, "") ?? "";
  const expectedBuffer = Buffer.from(syncToken);
  const suppliedBuffer = Buffer.from(supplied);
  if (
    expectedBuffer.length !== suppliedBuffer.length ||
    !timingSafeEqual(expectedBuffer, suppliedBuffer)
  )
    return undefined;
  return createHash("sha256").update(supplied).digest("hex").slice(0, 24);
}

const server = createServer(async (request, response) => {
  response.setHeader("X-Content-Type-Options", "nosniff");
  response.setHeader("Referrer-Policy", "no-referrer");

  if (request.method === "GET" && request.url === "/api/health") {
    const [ollamaAvailable, openRouterAvailable] = await Promise.all([
      ollama.isAvailable(),
      openRouter.isAvailable(),
    ]);
    return json(response, 200, {
      ok: true,
      providers: { ollama: ollamaAvailable, openrouter: openRouterAvailable },
    });
  }

  if (request.method === "POST" && request.url === "/api/ai") {
    try {
      const payload = (await body(request)) as AIRequest;
      if (!payload?.input || !payload.task || !payload.profile)
        return json(response, 400, {
          error: "task, profile, and input are required",
        });
      const result = await router.complete(payload);
      response.writeHead(200, {
        "Content-Type": "application/x-ndjson",
        "Cache-Control": "no-store",
      });
      for (const token of result.content.match(/\S+\s*/g) ?? [])
        response.write(`${JSON.stringify({ type: "delta", value: token })}\n`);
      response.end(
        `${JSON.stringify({ type: "done", providerId: result.providerId, model: result.model, sources: result.sources ?? [] })}\n`,
      );
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "AI request failed.";
      json(response, 503, { error: message });
    }
    return;
  }

  if (request.method === "POST" && request.url === "/api/sync") {
    const userId = authenticate(request);
    if (!userId)
      return json(response, 401, { error: "A valid sync token is required." });
    try {
      const payload = (await body(request)) as {
        cursor?: number;
        changes?: import("@ai-notes/sync").SyncChange[];
      };
      const result = await syncStore.sync(
        userId,
        payload.cursor ?? 0,
        payload.changes ?? [],
      );
      return json(response, 200, result);
    } catch (error) {
      return json(response, 400, {
        error: error instanceof Error ? error.message : "Sync failed.",
      });
    }
  }

  const historyMatch = request.url?.match(/^\/api\/notes\/([^/]+)\/history$/);
  if (request.method === "GET" && historyMatch) {
    const userId = authenticate(request);
    if (!userId)
      return json(response, 401, { error: "A valid sync token is required." });
    return json(response, 200, {
      history: await syncStore.history(
        userId,
        decodeURIComponent(historyMatch[1]!),
      ),
    });
  }

  const attachmentMatch = request.url?.match(
    /^\/api\/attachments\/([a-zA-Z0-9_-]+)$/,
  );
  if (attachmentMatch) {
    const userId = authenticate(request);
    if (!userId)
      return json(response, 401, { error: "A valid sync token is required." });
    const directory = join(dataRoot, "attachments", userId);
    const target = join(directory, attachmentMatch[1]!);
    if (request.method === "PUT") {
      const payload = (await body(request)) as {
        data?: string;
        contentType?: string;
        name?: string;
      };
      const bytes = Buffer.from(payload.data ?? "", "base64");
      if (!bytes.length || bytes.length > 10_000_000)
        return json(response, 400, {
          error: "Attachments must be between 1 byte and 10 MB.",
        });
      await mkdir(directory, { recursive: true });
      await writeFile(target, bytes, { mode: 0o600 });
      await writeFile(
        `${target}.json`,
        JSON.stringify({
          contentType: payload.contentType ?? "application/octet-stream",
          name: payload.name ?? attachmentMatch[1],
          size: bytes.length,
        }),
        { mode: 0o600 },
      );
      return json(response, 201, {
        id: attachmentMatch[1],
        size: bytes.length,
      });
    }
    if (request.method === "GET") {
      try {
        const metadata = JSON.parse(
          await readFile(`${target}.json`, "utf8"),
        ) as { contentType: string; name: string };
        const bytes = await readFile(target);
        response.writeHead(200, {
          "Content-Type": metadata.contentType,
          "Content-Disposition": `inline; filename="${metadata.name.replace(/["\r\n]/g, "_")}"`,
          "Cache-Control": "private, max-age=300",
        });
        response.end(bytes);
      } catch {
        return json(response, 404, { error: "Attachment not found." });
      }
      return;
    }
  }

  json(response, 404, { error: "Not found" });
});

server.listen(port, "127.0.0.1", () =>
  console.log(`AI Notes server listening at http://127.0.0.1:${port}`),
);
