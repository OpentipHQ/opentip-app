import { NextResponse } from "next/server";
import { sessionCookieOptions } from "@/lib/auth";
import { SESSION_COOKIE } from "@/lib/session";
import { TOAST_COOKIE, TOAST_MAX_AGE, encodeToast } from "@/lib/toast";

export async function POST(request: Request) {
  const response = NextResponse.redirect(new URL("/", request.url), { status: 303 });
  response.cookies.set(SESSION_COOKIE, "", sessionCookieOptions(0));
  response.cookies.set(
    TOAST_COOKIE,
    encodeToast({ tone: "success", message: "Signed out." }),
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
