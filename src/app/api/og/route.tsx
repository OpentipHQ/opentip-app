import { ogSecret } from "@/lib/config";
import { renderOgImage } from "@/lib/og/card";
import { parseOgParams, verifyOgSignature } from "@/lib/og/sign";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const parsed = parseOgParams({
    siteName: url.searchParams.get("site"),
    section: url.searchParams.get("section"),
    title: url.searchParams.get("title"),
    description: url.searchParams.get("description"),
    primary: url.searchParams.get("primary"),
    logo: url.searchParams.get("logo"),
    background: url.searchParams.get("background"),
  });
  if (!parsed.ok) {
    return new Response(parsed.error, { status: 400 });
  }
  const secret = ogSecret();
  if (!secret || !verifyOgSignature(parsed.params, url.searchParams.get("sig"), secret)) {
    return new Response("invalid_signature", { status: 403 });
  }
  return renderOgImage(parsed.params);
}
