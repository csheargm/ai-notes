import {
  createServer,
  type IncomingMessage,
  type ServerResponse,
} from "node:http";
import { loadEnvFile } from "node:process";
import { AIRouter, type AIRequest } from "@ai-notes/ai";
import { OllamaProvider, OpenRouterProvider } from "./providers.js";

try {
  loadEnvFile();
} catch {
  // Environment variables can also be supplied by the shell or deployment host.
}

const port = Number(process.env.AI_NOTES_SERVER_PORT ?? 8787);
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
    if (size > 1_000_000) throw new Error("Request is too large.");
    chunks.push(value);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
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

  json(response, 404, { error: "Not found" });
});

server.listen(port, "127.0.0.1", () =>
  console.log(`AI Notes server listening at http://127.0.0.1:${port}`),
);
