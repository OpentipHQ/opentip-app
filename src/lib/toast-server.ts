import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  encodeToast,
  TOAST_COOKIE,
  TOAST_MAX_AGE,
  type ToastPayload,
  type ToastTone,
} from "@/lib/toast";

export function toastCookieOptions() {
  return {
    path: "/",
    maxAge: TOAST_MAX_AGE,
    sameSite: "lax" as const,
    httpOnly: false,
    secure: process.env.NODE_ENV === "production",
  };
}

export function withToast(
  response: Response,
  tone: ToastTone,
  message: string,
): Response {
  response.headers.append(
    "Set-Cookie",
    `${TOAST_COOKIE}=${encodeURIComponent(encodeToast({ tone, message }))}; Path=/; Max-Age=${TOAST_MAX_AGE}; SameSite=Lax${
      process.env.NODE_ENV === "production" ? "; Secure" : ""
    }`,
  );
  return response;
}

export async function flashToast(tone: ToastTone, message: string): Promise<void> {
  const jar = await cookies();
  jar.set(TOAST_COOKIE, encodeToast({ tone, message }), toastCookieOptions());
}

export async function redirectWithToast(
  path: string,
  tone: ToastTone,
  message: string,
): Promise<never> {
  await flashToast(tone, message);
  redirect(path);
}

export type { ToastPayload, ToastTone };
