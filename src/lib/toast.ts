export const TOAST_COOKIE = "opentip-toast";
export const TOAST_MAX_AGE = 30;

export type ToastTone = "success" | "error" | "info";

export type ToastPayload = {
  tone: ToastTone;
  message: string;
};

export function encodeToast(payload: ToastPayload): string {
  return JSON.stringify(payload);
}

export function decodeToast(value: string): ToastPayload | null {
  try {
    const parsed = JSON.parse(decodeURIComponent(value)) as Partial<ToastPayload>;
    if (
      (parsed.tone === "success" || parsed.tone === "error" || parsed.tone === "info") &&
      typeof parsed.message === "string" &&
      parsed.message.length > 0
    ) {
      return { tone: parsed.tone, message: parsed.message };
    }
  } catch {
    return null;
  }
  return null;
}
