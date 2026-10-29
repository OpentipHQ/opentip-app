import {
  parseGenerationResult,
  type GenerationResult,
  type PageDraft,
} from "@/lib/copilot/contract";
import {
  chatEditRequest,
  firstBuildRequest,
  pushUpdateRequest,
  summaryRequest,
} from "@/lib/copilot/prompts";
import type { CompletionResult, CopilotProvider } from "@/lib/copilot/providers";
import type { RepoChange, RepoSnapshot } from "@/lib/github/repo-content";

export type GeneratedPages = {
  result: GenerationResult;
  completion: CompletionResult;
};

export async function generateFirstBuild(args: {
  provider: CopilotProvider;
  siteName: string;
  siteDescription: string | null;
  snapshot: RepoSnapshot;
}): Promise<GeneratedPages> {
  const request = firstBuildRequest(args);
  const completion = await args.provider.complete(request);
  const result = parseGenerationResult(completion.text, {
    allowEmpty: false,
    requireHome: true,
    maxPages: 10,
  });
  return { result, completion };
}

export async function generatePushUpdate(args: {
  provider: CopilotProvider;
  siteName: string;
  change: RepoChange;
  existingPages: PageDraft[];
}): Promise<GeneratedPages> {
  const request = pushUpdateRequest(args);
  const completion = await args.provider.complete(request);
  const result = parseGenerationResult(completion.text, {
    allowEmpty: true,
    maxPages: 8,
  });
  return { result, completion };
}

export async function generateChatEdit(args: {
  provider: CopilotProvider;
  siteName: string;
  page: PageDraft;
  instruction: string;
}): Promise<GeneratedPages> {
  const request = chatEditRequest(args);
  const completion = await args.provider.complete(request);
  const result = parseGenerationResult(completion.text, {
    allowEmpty: false,
    maxPages: 1,
  });
  if (result.pages.length !== 1) {
    throw new Error("The chat edit did not return exactly one page.");
  }
  return { result, completion };
}

export async function generateRepoSummary(args: {
  provider: CopilotProvider;
  siteName: string;
  snapshot: RepoSnapshot;
}): Promise<{ text: string; completion: CompletionResult }> {
  const completion = await args.provider.complete(summaryRequest(args));
  const text = completion.text.trim();
  if (!text) throw new Error("The summary was empty.");
  return { text: text.slice(0, 4_000), completion };
}
