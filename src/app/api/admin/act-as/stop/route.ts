import { NextResponse } from "next/server";
import { clearActAsCookie } from "@/lib/admin/act-as";
import { getRequestSession } from "@/lib/auth";
import { requestOrigin } from "@/lib/auth/http";
import { TOAST_COOKIE, TOAST_MAX_AGE, encodeToast } from "@/lib/toast";

export async function POST(request: Request) {
  const session = await getRequestSession();
  const origin = requestOrigin(request);
  await clearActAsCookie();
  const response = NextResponse.redirect(
    new URL(session?.role === "ADMIN" ? "/admin/users" : "/dashboard", origin),
  );
  response.cookies.set(
    TOAST_COOKIE,
    encodeToast({ tone: "success", message: "Stopped viewing as user." }),
    {
      path: "/",
      maxAge: TOAST_MAX_AGE,
      sameSite: "lax",
      httpOnly: false,
      secure: process.env.NODE_ENV === "production",
    },
  );
  return response;
}
