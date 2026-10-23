export type SessionRole = "USER" | "ADMIN";

export type Session = {
  userId: string;
  login: string;
  name: string | null;
  role: SessionRole;
  exp: number;
};

export const SESSION_COOKIE = "opentip_session";
export const OAUTH_STATE_COOKIE = "opentip_oauth_state";

const textEncoder = new TextEncoder();

function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

function fromBase64Url(value: string): Uint8Array | null {
  try {
    const padded = value.replaceAll("-", "+").replaceAll("_", "/") + "===".slice((value.length + 3) % 4);
    const binary = atob(padded);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) {
      bytes[index] = binary.charCodeAt(index);
    }
    return bytes;
  } catch {
    return null;
  }
}

async function hmac(secret: string, value: string): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    "raw",
    textEncoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, textEncoder.encode(value));
  return new Uint8Array(signature);
}

function timingSafeEqualBytes(left: Uint8Array, right: Uint8Array): boolean {
  if (left.length !== right.length) return false;
  let mismatch = 0;
  for (let index = 0; index < left.length; index += 1) {
    mismatch |= left[index] ^ right[index];
  }
  return mismatch === 0;
}

export async function signSession(session: Session, secret: string): Promise<string> {
  const body = toBase64Url(textEncoder.encode(JSON.stringify(session)));
  const signature = toBase64Url(await hmac(secret, body));
  return `${body}.${signature}`;
}

export async function verifySession(
  token: string | undefined,
  secret: string,
  now = Date.now(),
): Promise<Session | null> {
  if (!token || !secret) return null;
  const [body, signature] = token.split(".");
  if (!body || !signature || token.split(".").length !== 2) return null;
  const expected = await hmac(secret, body);
  const actual = fromBase64Url(signature);
  if (!actual || !timingSafeEqualBytes(actual, expected)) return null;
  const jsonBytes = fromBase64Url(body);
  if (!jsonBytes) return null;
  try {
    const parsed = JSON.parse(new TextDecoder().decode(jsonBytes)) as Session;
    if (!parsed.userId || !parsed.login || !parsed.exp) return null;
    if (parsed.role !== "USER" && parsed.role !== "ADMIN") return null;
    if (parsed.exp <= now) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function sessionCookieOptions(
  maxAgeSeconds: number,
  nodeEnv: string | undefined = process.env.NODE_ENV,
) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: nodeEnv === "production",
    path: "/",
    maxAge: maxAgeSeconds,
  };
}

export function devBypassEnabled(
  env: { NODE_ENV?: string; AUTH_DEV_BYPASS?: string } = process.env,
): boolean {
  return env.NODE_ENV !== "production" && env.AUTH_DEV_BYPASS === "1";
}

export function devSession(now = Date.now()): Session {
  return {
    userId: "dev_preview",
    login: "dev",
    name: "Dev preview",
    role: "ADMIN",
    exp: now + 1000 * 60 * 60,
  };
}
