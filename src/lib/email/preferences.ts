import { createHmac, timingSafeEqual } from "node:crypto";
import { normalizeEmail } from "@/lib/auth/login-code";
import { appUrl, sessionSecret } from "@/lib/config";
import { getPrisma } from "@/lib/db";

const TOKEN_VERSION = "v1";
const TOKEN_CONTEXT = "opentip-email-preferences";

function tokenSignature(payload: string, secret: string): string {
  return createHmac("sha256", secret)
    .update(`${TOKEN_CONTEXT}:${payload}`)
    .digest("base64url");
}

export function emailPreferenceToken(
  emailRaw: string,
  secret: string | null = sessionSecret(),
): string | null {
  const email = normalizeEmail(emailRaw);
  if (!email || !secret) return null;
  const encoded = Buffer.from(email, "utf8").toString("base64url");
  const payload = `${TOKEN_VERSION}.${encoded}`;
  return `${payload}.${tokenSignature(payload, secret)}`;
}

export function readEmailPreferenceToken(
  token: string | null | undefined,
  secret: string | null = sessionSecret(),
): string | null {
  if (!token || !secret) return null;
  const parts = token.split(".");
  if (parts.length !== 3 || parts[0] !== TOKEN_VERSION) return null;
  const payload = `${parts[0]}.${parts[1]}`;
  const expected = tokenSignature(payload, secret);
  const received = parts[2];
  if (received.length !== expected.length) return null;
  if (!timingSafeEqual(Buffer.from(received), Buffer.from(expected))) return null;
  try {
    return normalizeEmail(Buffer.from(parts[1], "base64url").toString("utf8"));
  } catch {
    return null;
  }
}

export function emailPreferenceLinks(
  emailRaw: string,
  baseUrl: string = appUrl(),
): {
  manageUrl: string;
  unsubscribeUrl: string;
  oneClickUnsubscribeUrl: string;
} | null {
  const token = emailPreferenceToken(emailRaw);
  if (!token) return null;
  const base = baseUrl.replace(/\/$/, "");
  const encoded = encodeURIComponent(token);
  return {
    manageUrl: `${base}/email/preferences?token=${encoded}`,
    unsubscribeUrl: `${base}/email/preferences?token=${encoded}&intent=unsubscribe`,
    oneClickUnsubscribeUrl: `${base}/api/email/unsubscribe?token=${encoded}`,
  };
}

export type AnnouncementPreference =
  | { state: "ok"; announcements: boolean }
  | { state: "invalid" }
  | { state: "no-database" };

export async function loadAnnouncementPreference(
  emailRaw: string,
): Promise<AnnouncementPreference> {
  const email = normalizeEmail(emailRaw);
  if (!email) return { state: "invalid" };
  const prisma = getPrisma();
  if (!prisma) return { state: "no-database" };
  const row = await prisma.emailPreference.findUnique({
    where: { email },
    select: { announcements: true },
  });
  return { state: "ok", announcements: row?.announcements ?? true };
}

export async function setAnnouncementPreference(
  emailRaw: string,
  announcements: boolean,
): Promise<AnnouncementPreference> {
  const email = normalizeEmail(emailRaw);
  if (!email) return { state: "invalid" };
  const prisma = getPrisma();
  if (!prisma) return { state: "no-database" };
  await prisma.emailPreference.upsert({
    where: { email },
    create: { email, announcements },
    update: { announcements },
  });
  return { state: "ok", announcements };
}

export async function filterAnnouncementRecipients(emailsRaw: string[]): Promise<{
  recipients: string[];
  suppressed: string[];
}> {
  const emails = Array.from(
    new Set(
      emailsRaw
        .map((email) => normalizeEmail(email))
        .filter((email): email is string => Boolean(email)),
    ),
  );
  const prisma = getPrisma();
  if (!prisma || emails.length === 0) return { recipients: emails, suppressed: [] };
  const optedOut = await prisma.emailPreference.findMany({
    where: { email: { in: emails }, announcements: false },
    select: { email: true },
  });
  const suppressed = new Set(optedOut.map((row) => row.email));
  return {
    recipients: emails.filter((email) => !suppressed.has(email)),
    suppressed: emails.filter((email) => suppressed.has(email)),
  };
}
