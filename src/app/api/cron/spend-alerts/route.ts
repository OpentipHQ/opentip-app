import { runSpendAlerts } from "@/lib/admin/spend-check";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const header = request.headers.get("authorization") ?? "";
  if (!secret || header !== `Bearer ${secret}`) {
    return Response.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  const result = await runSpendAlerts();
  return Response.json({ ok: true, ...result });
}

export const POST = GET;
