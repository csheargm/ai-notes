export type AIProfile = "default" | "fast" | "deep" | "local" | "agent";
export type AITask =
  | "summarize"
  | "explain"
  | "rewrite"
  | "action-items"
  | "generate-tags"
  | "ask-note";

export type AIRequest = {
  task: AITask;
  input: string;
  profile: AIProfile;
  context?: Array<{ sourceId: string; content: string }>;
};

export type AIResponse = {
  content: string;
  providerId: string;
  model?: string;
  sources?: string[];
};

export type AICapabilities = {
  profiles: AIProfile[];
  tasks: AITask[];
  streaming: boolean;
  local: boolean;
  agent: boolean;
};

export interface AIProvider {
  readonly id: string;
  readonly name: string;
  readonly capabilities: AICapabilities;
  isAvailable(): Promise<boolean>;
  complete(request: AIRequest): Promise<AIResponse>;
}

export class AIRouter {
  constructor(private readonly providers: AIProvider[]) {}

  async select(request: AIRequest): Promise<AIProvider | undefined> {
    for (const provider of this.providers) {
      const capabilities = provider.capabilities;
      if (!capabilities.profiles.includes(request.profile)) continue;
      if (!capabilities.tasks.includes(request.task)) continue;
      if (request.profile === "local" && !capabilities.local) continue;
      if (request.profile === "agent" && !capabilities.agent) continue;
      if (await provider.isAvailable()) return provider;
    }
    return undefined;
  }

  async complete(request: AIRequest): Promise<AIResponse> {
    const provider = await this.select(request);
    if (!provider)
      throw new Error(
        `No available AI provider supports ${request.task} with the ${request.profile} profile.`,
      );
    return provider.complete(request);
  }
}
