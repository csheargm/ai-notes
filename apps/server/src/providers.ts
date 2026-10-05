import type {
  AICapabilities,
  AIProvider,
  AIRequest,
  AIResponse,
  AITask,
} from "@ai-notes/ai";

type Fetch = typeof fetch;

const tasks: AITask[] = [
  "summarize",
  "explain",
  "rewrite",
  "action-items",
  "generate-tags",
  "ask-note",
];

const instructions: Record<AITask, string> = {
  summarize:
    "Summarize the note clearly. Preserve decisions, facts, and uncertainties.",
  explain:
    "Explain the note in plain language. Define unfamiliar ideas and do not invent facts.",
  rewrite: "Rewrite the note for clarity while preserving its meaning.",
  "action-items":
    "Extract concrete action items. Use a concise Markdown checklist.",
  "generate-tags":
    "Return 3 to 7 concise tags as a comma-separated list and nothing else.",
  "ask-note":
    "Answer the user's question using only the supplied note and source context. Say when the answer is not present.",
};

export function promptFor(request: AIRequest): string {
  const context =
    request.context
      ?.map((item) => `[Source ${item.sourceId}]\n${item.content}`)
      .join("\n\n") ?? "";
  return `${instructions[request.task]}\n\n${context ? `${context}\n\n` : ""}[Note]\n${request.input}`;
}

export class OpenRouterProvider implements AIProvider {
  readonly id = "openrouter";
  readonly name = "OpenRouter";
  readonly capabilities: AICapabilities = {
    profiles: ["default", "fast", "deep"],
    tasks,
    streaming: true,
    local: false,
    agent: false,
  };

  constructor(
    private readonly apiKey: string | undefined,
    private readonly models: Partial<
      Record<"default" | "fast" | "deep", string>
    >,
    private readonly fetcher: Fetch = fetch,
  ) {}

  async isAvailable() {
    return Boolean(this.apiKey);
  }

  private model(profile: AIRequest["profile"]) {
    if (profile === "fast") return this.models.fast ?? "openai/gpt-4.1-mini";
    if (profile === "deep")
      return this.models.deep ?? "anthropic/claude-sonnet-4";
    return this.models.default ?? "openai/gpt-4.1";
  }

  async complete(request: AIRequest): Promise<AIResponse> {
    if (!this.apiKey) throw new Error("OpenRouter is not configured.");
    const model = this.model(request.profile);
    const response = await this.fetcher(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
          "HTTP-Referer": "http://localhost",
          "X-Title": "AI Notes",
        },
        body: JSON.stringify({
          model,
          messages: [{ role: "user", content: promptFor(request) }],
        }),
      },
    );
    if (!response.ok)
      throw new Error(`OpenRouter request failed (${response.status}).`);
    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    return {
      content: data.choices?.[0]?.message?.content ?? "",
      providerId: this.id,
      model,
    };
  }
}

export class OllamaProvider implements AIProvider {
  readonly id = "ollama";
  readonly name = "Ollama";
  readonly capabilities: AICapabilities = {
    profiles: ["local"],
    tasks,
    streaming: true,
    local: true,
    agent: false,
  };

  constructor(
    private readonly baseUrl = "http://127.0.0.1:11434",
    private readonly model = "llama3.2",
    private readonly fetcher: Fetch = fetch,
  ) {}

  async isAvailable() {
    try {
      const response = await this.fetcher(`${this.baseUrl}/api/tags`, {
        signal: AbortSignal.timeout(800),
      });
      if (!response.ok) return false;
      const data = (await response.json()) as {
        models?: Array<{ name?: string; model?: string }>;
      };
      return Boolean(
        data.models?.some((item) => {
          const name = item.model ?? item.name ?? "";
          return name === this.model || name.startsWith(`${this.model}:`);
        }),
      );
    } catch {
      return false;
    }
  }

  async complete(request: AIRequest): Promise<AIResponse> {
    const response = await this.fetcher(`${this.baseUrl}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: this.model,
        prompt: promptFor(request),
        stream: false,
      }),
    });
    if (!response.ok)
      throw new Error(`Ollama request failed (${response.status}).`);
    const data = (await response.json()) as { response?: string };
    return {
      content: data.response ?? "",
      providerId: this.id,
      model: this.model,
    };
  }
}
