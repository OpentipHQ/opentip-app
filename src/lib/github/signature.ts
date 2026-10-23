import { createHmac, timingSafeEqual } from "node:crypto";

export function signGithubBody(rawBody: string, secret: string): string {
  return `sha256=${createHmac("sha256", secret).update(rawBody).digest("hex")}`;
}

export function verifyGithubSignature(
  rawBody: string,
  signatureHeader: string | null,
  secret: string,
): boolean {
  if (!secret || !signatureHeader || !signatureHeader.startsWith("sha256=")) {
    return false;
  }
  const expected = signGithubBody(rawBody, secret);
  const actual = Buffer.from(signatureHeader);
  const wanted = Buffer.from(expected);
  if (actual.length !== wanted.length) return false;
  return timingSafeEqual(actual, wanted);
}
