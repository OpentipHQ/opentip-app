import { cronAuthorized } from "@/lib/admin/cron-auth";
import { runSpendAlerts } from "@/lib/admin/spend-check";

export const runtime = "nodejs";

export async function GET(request: Request) {
  if (!cronAuthorized(request.headers.get("authorization"), process.env.CRON_SECRET)) {
    return Response.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  const result = await runSpendAlerts();
  return Response.json({ ok: true, ...result });
}

export const POST = GET;
