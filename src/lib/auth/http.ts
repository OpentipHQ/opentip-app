import { NextResponse } from "next/server";
import { sessionCookieOptions } from "@/lib/auth";

export function requestOrigin(request: Request): string {
  const url = new URL(request.url);
  const forwardedHost = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
  const host = forwardedHost || request.headers.get("host");
  if (!host) return url.origin;
  const forwardedProto = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
  const proto = forwardedProto || url.protocol.replace(":", "") || "http";
  return `${proto}://${host}`;
}

export function redirectWithCookies(
  origin: string,
  path: string,
  cookies: Array<{ name: string; value: string; maxAge: number }>,
) {
  const response = NextResponse.redirect(new URL(path, origin));
  for (const cookie of cookies) {
    response.cookies.set(cookie.name, cookie.value, sessionCookieOptions(Math.max(0, cookie.maxAge)));
  }
  return response;
}

export function clientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (!forwarded) return "local";
  return forwarded.split(",")[0]?.trim() || "local";
}
