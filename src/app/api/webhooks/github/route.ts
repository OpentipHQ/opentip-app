import { verifyGithubSignature } from "@/lib/github/signature";
import { createPrismaWebhookRepository } from "@/lib/github/prisma-repository";
import { handleGithubWebhook } from "@/lib/github/webhook";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const rawBody = await request.text();
  const secret = process.env.GITHUB_WEBHOOK_SECRET ?? "";
  const headers = {
    deliveryId: request.headers.get("x-github-delivery"),
    event: request.headers.get("x-github-event"),
    signature: request.headers.get("x-hub-signature-256"),
  };
  const repo = createPrismaWebhookRepository();
  if (!repo) {
    if (!verifyGithubSignature(rawBody, headers.signature, secret)) {
      return Response.json({ ok: false, error: "invalid_signature" }, { status: 401 });
    }
    if (headers.event === "ping") {
      return Response.json({ ok: true, duplicate: false, event: "ping" });
    }
    return Response.json({ ok: false, error: "database_unconfigured" }, { status: 503 });
  }
  const result = await handleGithubWebhook({ rawBody, headers, secret, repo });
  return Response.json(result.body, { status: result.status });
}
