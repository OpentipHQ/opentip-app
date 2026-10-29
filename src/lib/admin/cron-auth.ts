import { createHash, timingSafeEqual } from "node:crypto";

export function cronAuthorized(header: string | null, secret: string | undefined): boolean {
  if (!secret) return false;
  const actual = createHash("sha256").update(header ?? "").digest();
  const expected = createHash("sha256").update(`Bearer ${secret}`).digest();
  return timingSafeEqual(actual, expected);
}
