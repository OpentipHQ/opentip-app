import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const url = new URL(request.url);
  if (url.searchParams.get("code")) {
    const callback = new URL("/api/auth/github/callback", url.origin);
    callback.search = url.search;
    return NextResponse.redirect(callback);
  }
  const next = new URL("/dashboard", url.origin);
  const installationId = url.searchParams.get("installation_id");
  if (installationId) next.searchParams.set("installation_id", installationId);
  return NextResponse.redirect(next);
}
