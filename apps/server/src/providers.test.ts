import { describe, expect, it, vi } from "vitest";
import { OllamaProvider, OpenRouterProvider, promptFor } from "./providers.js";

const request = {
  task: "summarize",
  profile: "default",
  input: "A note",
} as const;

describe("AI providers", () => {
  it("builds task-specific prompts with provenance", () => {
    expect(
      promptFor({
        ...request,
        context: [{ sourceId: "paper", content: "Evidence" }],
      }),
    ).toContain("[Source paper]\nEvidence");
  });

  it("keeps OpenRouter credentials on the server request", async () => {
    const fetcher = vi.fn(
      async () =>
        new Response(
          JSON.stringify({ choices: [{ message: { content: "Summary" } }] }),
          { status: 200 },
        ),
    );
    const provider = new OpenRouterProvider(
      "secret",
      { default: "test/model" },
      fetcher as typeof fetch,
    );
    expect((await provider.complete(request)).content).toBe("Summary");
    const call = fetcher.mock.calls[0] as unknown as [string, RequestInit];
    expect(call[1].headers).toMatchObject({
      Authorization: "Bearer secret",
    });
  });

  it("reports unavailable Ollama without throwing", async () => {
    const provider = new OllamaProvider(
      "http://ollama",
      "model",
      vi.fn(async () => {
        throw new Error("offline");
      }) as typeof fetch,
    );
    expect(await provider.isAvailable()).toBe(false);
  });

  it("requires the configured Ollama model to be installed", async () => {
    const fetcher = vi.fn(
      async () =>
        new Response(JSON.stringify({ models: [{ name: "other:latest" }] }), {
          status: 200,
        }),
    );
    const provider = new OllamaProvider(
      "http://ollama",
      "required",
      fetcher as typeof fetch,
    );
    expect(await provider.isAvailable()).toBe(false);
  });
});
