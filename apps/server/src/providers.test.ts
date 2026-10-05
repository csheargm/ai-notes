import { describe, expect, it, vi } from "vitest";
import {
  MLXProvider,
  OllamaProvider,
  OpenRouterProvider,
  promptFor,
} from "./providers.js";

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

  it("streams OpenRouter server-sent events", async () => {
    const provider = new OpenRouterProvider(
      "secret",
      { default: "test/model" },
      vi.fn(
        async () =>
          new Response(
            'data: {"choices":[{"delta":{"content":"Hello"}}]}\n\n' +
              'data: {"choices":[{"delta":{"content":" world"}}]}\n\n' +
              "data: [DONE]\n\n",
          ),
      ) as typeof fetch,
    );
    const parts: string[] = [];
    for await (const part of provider.stream(request)) parts.push(part);
    expect(parts.join("")).toBe("Hello world");
  });

  it("streams Ollama newline-delimited responses", async () => {
    const provider = new OllamaProvider(
      "http://ollama",
      "model",
      vi.fn(
        async () =>
          new Response('{"response":"Local"}\n{"response":" answer"}\n'),
      ) as typeof fetch,
    );
    const parts: string[] = [];
    for await (const part of provider.stream({ ...request, profile: "local" }))
      parts.push(part);
    expect(parts.join("")).toBe("Local answer");
  });

  it("detects and completes against an OpenAI-compatible MLX server", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ data: [{ id: "mlx-model" }] })),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            choices: [{ message: { content: "On-device answer" } }],
          }),
        ),
      );
    const provider = new MLXProvider("http://mlx/v1", "mlx-model", fetcher);
    expect(await provider.isAvailable()).toBe(true);
    expect(
      (await provider.complete({ ...request, profile: "local" })).content,
    ).toBe("On-device answer");
    expect(fetcher.mock.calls[1]?.[0]).toBe("http://mlx/v1/chat/completions");
  });
});
