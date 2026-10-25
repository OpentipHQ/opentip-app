"use server";

import { redirect } from "next/navigation";
import {
  readEmailPreferenceToken,
  setAnnouncementPreference,
} from "@/lib/email/preferences";

function preferencesUrl(token: string, params: Record<string, string>): string {
  const search = new URLSearchParams({ token, ...params });
  return `/email/preferences?${search.toString()}`;
}

export async function updateEmailPreferences(formData: FormData) {
  const token = String(formData.get("token") ?? "");
  const email = readEmailPreferenceToken(token);
  if (!email) redirect("/email/preferences?error=invalid");

  const intent = String(formData.get("intent") ?? "save");
  const announcements =
    intent === "unsubscribe" ? false : formData.get("announcements") === "on";
  const result = await setAnnouncementPreference(email, announcements);
  if (result.state !== "ok") {
    redirect(preferencesUrl(token, { error: result.state }));
  }
  redirect(preferencesUrl(token, { saved: announcements ? "on" : "off" }));
}
