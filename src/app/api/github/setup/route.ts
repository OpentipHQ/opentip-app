import { NextResponse } from "next/server";
import { requestOrigin } from "@/lib/auth/http";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const origin = requestOrigin(request);
  if (url.searchParams.get("code")) {
    const next = new URL("/api/auth/github/callback", origin);
    url.searchParams.forEach((value, key) => next.searchParams.set(key, value));
    return NextResponse.redirect(next);
  }
  return NextResponse.redirect(new URL("/login?from=install", origin));
}
