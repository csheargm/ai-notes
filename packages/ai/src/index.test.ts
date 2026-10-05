import { describe, expect, it } from "vitest";
import { AIRouter, type AIProvider, type AIRequest } from "./index";

const request: AIRequest = {
  task: "summarize",
  input: "Text",
  profile: "local",
};

function provider(overrides: Partial<AIProvider> = {}): AIProvider {
  return {
    id: "provider",
    name: "Provider",
    capabilities: {
      profiles: ["local"],
      tasks: ["summarize"],
      streaming: false,
      local: true,
      agent: false,
    },
    isAvailable: async () => true,
    complete: async () => ({ content: "Summary", providerId: "provider" }),
    ...overrides,
  };
}

describe("AIRouter", () => {
  it("selects the first available provider matching task and profile", async () => {
    const unavailable = provider({
      id: "offline",
      isAvailable: async () => false,
    });
    const selected = provider({ id: "local" });
    expect(
      (await new AIRouter([unavailable, selected]).select(request))?.id,
    ).toBe("local");
  });

  it("fails clearly when no provider is available", async () => {
    await expect(new AIRouter([]).complete(request)).rejects.toThrow(
      "No available AI provider",
    );
  });
});
