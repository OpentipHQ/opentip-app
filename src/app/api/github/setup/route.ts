import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const next = new URL("/dashboard", url.origin);
  const installationId = url.searchParams.get("installation_id");
  if (installationId) next.searchParams.set("installation_id", installationId);
  return NextResponse.redirect(next);
}
