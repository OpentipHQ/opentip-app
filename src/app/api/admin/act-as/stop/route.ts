import { NextResponse } from "next/server";
import { clearActAsCookie } from "@/lib/admin/act-as";
import { getRequestSession } from "@/lib/auth";
import { requestOrigin } from "@/lib/auth/http";

export async function POST(request: Request) {
  const session = await getRequestSession();
  const origin = requestOrigin(request);
  await clearActAsCookie();
  return NextResponse.redirect(new URL(session?.role === "ADMIN" ? "/admin/users" : "/dashboard", origin));
}
