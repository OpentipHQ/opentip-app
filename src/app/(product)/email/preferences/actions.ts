"use server";

import {
  readEmailPreferenceToken,
  setAnnouncementPreference,
} from "@/lib/email/preferences";
import { redirectWithToast } from "@/lib/toast-server";

function preferencesUrl(token: string, params: Record<string, string>): string {
  const search = new URLSearchParams({ token, ...params });
  return `/email/preferences?${search.toString()}`;
}

export async function updateEmailPreferences(formData: FormData) {
  const token = String(formData.get("token") ?? "");
  const email = readEmailPreferenceToken(token);
  if (!email) {
    return redirectWithToast(
      "/email/preferences?error=invalid",
      "error",
      "That preferences link is invalid or expired.",
    );
  }

  const intent = String(formData.get("intent") ?? "save");
  const announcements =
    intent === "unsubscribe" ? false : formData.get("announcements") === "on";
  const result = await setAnnouncementPreference(email, announcements);
  if (result.state !== "ok") {
    return redirectWithToast(
      preferencesUrl(token, { error: result.state }),
      "error",
      "Could not save your email preferences.",
    );
  }
  return redirectWithToast(
    preferencesUrl(token, { saved: announcements ? "on" : "off" }),
    "success",
    announcements ? "Email preferences saved." : "You are unsubscribed from product updates.",
  );
}
