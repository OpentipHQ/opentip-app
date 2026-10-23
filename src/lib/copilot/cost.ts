export type RateCard = {
  inputUsdPerMillion: number;
  outputUsdPerMillion: number;
};

export const DEFAULT_XAI_RATES: RateCard = {
  inputUsdPerMillion: 3,
  outputUsdPerMillion: 15,
};

export const DEFAULT_GROQ_RATES: RateCard = {
  inputUsdPerMillion: 0.15,
  outputUsdPerMillion: 0.75,
};

export function readRate(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return fallback;
  return parsed;
}

export function ratesFromEnv(
  provider: "xai" | "groq",
  env: Record<string, string | undefined>,
): RateCard {
  if (provider === "xai") {
    return {
      inputUsdPerMillion: readRate(
        env.XAI_INPUT_USD_PER_MTOK,
        DEFAULT_XAI_RATES.inputUsdPerMillion,
      ),
      outputUsdPerMillion: readRate(
        env.XAI_OUTPUT_USD_PER_MTOK,
        DEFAULT_XAI_RATES.outputUsdPerMillion,
      ),
    };
  }
  return {
    inputUsdPerMillion: readRate(
      env.GROQ_INPUT_USD_PER_MTOK,
      DEFAULT_GROQ_RATES.inputUsdPerMillion,
    ),
    outputUsdPerMillion: readRate(
      env.GROQ_OUTPUT_USD_PER_MTOK,
      DEFAULT_GROQ_RATES.outputUsdPerMillion,
    ),
  };
}

export function estimateCostUsd(
  tokens: { prompt: number; completion: number },
  rates: RateCard,
): number {
  const cost =
    (tokens.prompt * rates.inputUsdPerMillion +
      tokens.completion * rates.outputUsdPerMillion) /
    1_000_000;
  return Math.round(cost * 1_000_000) / 1_000_000;
}

export function reserveTokens(task: "heavy" | "small"): {
  prompt: number;
  completion: number;
} {
  if (task === "heavy") return { prompt: 20_000, completion: 8_000 };
  return { prompt: 4_000, completion: 1_500 };
}
