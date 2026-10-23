import { NextResponse, type NextRequest } from "next/server";
import { appHosts, docsRootDomain, sessionSecret } from "@/lib/config";
import { decideProxy } from "@/lib/sites/host";
import {
  SESSION_COOKIE,
  devBypassEnabled,
  devSession,
  verifySession,
} from "@/lib/session";

export async function proxy(request: NextRequest) {
  const decision = decideProxy({
    host: request.headers.get("host") ?? "",
    pathname: request.nextUrl.pathname,
    appHosts: appHosts(),
    docsRootDomain: docsRootDomain(),
  });

  if (decision.kind === "rewrite") {
    const url = request.nextUrl.clone();
    url.pathname = decision.pathname;
    const headers = new Headers(request.headers);
    headers.set("x-opentip-public-host", decision.publicHost);
    return NextResponse.rewrite(url, { request: { headers } });
  }

  if (decision.kind === "protect") {
    const session = await readSession(request);
    if (!session) {
      const url = request.nextUrl.clone();
      url.pathname = "/sign-in";
      url.searchParams.set("next", request.nextUrl.pathname);
      return NextResponse.redirect(url);
    }
    if (decision.area === "admin" && session.role !== "ADMIN") {
      const url = request.nextUrl.clone();
      url.pathname = "/dashboard";
      return NextResponse.redirect(url);
    }
  }

  return NextResponse.next();
}

async function readSession(request: NextRequest) {
  if (devBypassEnabled()) return devSession();
  const secret = sessionSecret();
  if (!secret) return null;
  return verifySession(request.cookies.get(SESSION_COOKIE)?.value, secret);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|.*\\.png$).*)"],
};
