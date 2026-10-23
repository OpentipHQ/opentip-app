import { estimateCostUsd, ratesFromEnv, type RateCard } from "@/lib/copilot/cost";
import {
  selectModel,
  type ProviderId,
  type TaskSize,
} from "@/lib/copilot/models";

export type CompletionRequest = {
  system: string;
  user: string;
};

export type CompletionResult = {
  text: string;
  provider: ProviderId;
  model: string;
  promptTokens: number;
  completionTokens: number;
  estimatedCostUsd: number;
};

export interface CopilotProvider {
  id: ProviderId;
  model: string;
  task: TaskSize;
  complete(request: CompletionRequest): Promise<CompletionResult>;
}

export class ProviderNotConfiguredError extends Error {
  constructor(provider: "xai" | "groq") {
    super(
      provider === "xai"
        ? "XAI_API_KEY is required in production"
        : "GROQ_API_KEY is required in production",
    );
    this.name = "ProviderNotConfiguredError";
  }
}

type ChatResponse = {
  choices?: Array<{ message?: { content?: string } }>;
  usage?: { prompt_tokens?: number; completion_tokens?: number };
};

async function completeChat(args: {
  url: string;
  apiKey: string;
  model: string;
  provider: "xai" | "groq";
  task: TaskSize;
  request: CompletionRequest;
  rates: RateCard;
  timeoutMs: number;
}): Promise<CompletionResult> {
  const response = await fetch(args.url, {
    method: "POST",
    headers: {
      authorization: `Bearer ${args.apiKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: args.model,
      messages: [
        { role: "system", content: args.request.system },
        { role: "user", content: args.request.user },
      ],
    }),
    signal: AbortSignal.timeout(args.timeoutMs),
  });
  if (!response.ok) {
    throw new Error(`${args.provider} request failed (${response.status})`);
  }
  const json = (await response.json()) as ChatResponse;
  const text = json.choices?.[0]?.message?.content ?? "";
  const promptTokens =
    json.usage?.prompt_tokens ??
    Math.ceil((args.request.system.length + args.request.user.length) / 4);
  const completionTokens =
    json.usage?.completion_tokens ?? Math.ceil(text.length / 4);
  return {
    text,
    provider: args.provider,
    model: args.model,
    promptTokens,
    completionTokens,
    estimatedCostUsd: estimateCostUsd(
      { prompt: promptTokens, completion: completionTokens },
      args.rates,
    ),
  };
}

export function createFakeProvider(task: TaskSize, model: string): CopilotProvider {
  return {
    id: "fake",
    model,
    task,
    async complete(request) {
      const text = `Fake ${task} completion.\n\n${request.user.slice(0, 240)}`;
      return {
        text,
        provider: "fake",
        model,
        promptTokens: Math.max(1, Math.ceil(request.user.length / 4)),
        completionTokens: Math.max(1, Math.ceil(text.length / 4)),
        estimatedCostUsd: 0,
      };
    },
  };
}

export function createXaiProvider(
  model: string,
  apiKey: string,
  env: Record<string, string | undefined>,
): CopilotProvider {
  return {
    id: "xai",
    model,
    task: "heavy",
    complete(request) {
      return completeChat({
        url: "https://api.x.ai/v1/chat/completions",
        apiKey,
        model,
        provider: "xai",
        task: "heavy",
        request,
        rates: ratesFromEnv("xai", env),
        timeoutMs: 120_000,
      });
    },
  };
}

export function createGroqProvider(
  model: string,
  apiKey: string,
  env: Record<string, string | undefined>,
): CopilotProvider {
  return {
    id: "groq",
    model,
    task: "small",
    complete(request) {
      return completeChat({
        url: "https://api.groq.com/openai/v1/chat/completions",
        apiKey,
        model,
        provider: "groq",
        task: "small",
        request,
        rates: ratesFromEnv("groq", env),
        timeoutMs: 45_000,
      });
    },
  };
}

export function resolveProvider(
  task: TaskSize,
  env: Record<string, string | undefined> = process.env,
): CopilotProvider {
  const choice = selectModel(task, env);
  const production = env.NODE_ENV === "production";
  const forceFake = env.COPILOT_PROVIDER === "fake";
  if (choice.provider === "xai") {
    if (env.XAI_API_KEY && !forceFake) {
      return createXaiProvider(choice.model, env.XAI_API_KEY, env);
    }
    if (production && !forceFake) throw new ProviderNotConfiguredError("xai");
    return createFakeProvider(task, choice.model);
  }
  if (env.GROQ_API_KEY && !forceFake) {
    return createGroqProvider(choice.model, env.GROQ_API_KEY, env);
  }
  if (production && !forceFake) throw new ProviderNotConfiguredError("groq");
  return createFakeProvider(task, choice.model);
}
