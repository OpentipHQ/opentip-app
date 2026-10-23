import { appendFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import type { InviteEmailResult } from "@/lib/email/resend";

export async function sendLoginCodeEmail(args: {
  to: string;
  code: string;
  env?: {
    RESEND_API_KEY?: string;
    RESEND_FROM?: string;
    NODE_ENV?: string;
    LOGIN_CODE_SINK?: string;
  };
}): Promise<InviteEmailResult | { delivered: false; mode: "sink" }> {
  const env = args.env ?? process.env;
  const apiKey = env.RESEND_API_KEY;
  const from = env.RESEND_FROM;
  if (!apiKey || !from) {
    if (env.NODE_ENV === "production") {
      throw new Error("RESEND_API_KEY and RESEND_FROM are required in production");
    }
    if (env.LOGIN_CODE_SINK) {
      mkdirSync(dirname(env.LOGIN_CODE_SINK), { recursive: true });
      appendFileSync(env.LOGIN_CODE_SINK, `${args.to} ${args.code}\n`, "utf8");
      return { delivered: false, mode: "sink" };
    }
    return { delivered: false, mode: "skipped" };
  }
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      authorization: `Bearer ${apiKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [args.to],
      subject: "Your Opentip sign-in code",
      text: `Your Opentip code is ${args.code}. It expires in 10 minutes.\n\nIf you did not ask for this, you can ignore this email.\n`,
    }),
  });
  if (!response.ok) {
    throw new Error(`Resend request failed (${response.status})`);
  }
  return { delivered: true, mode: "resend" };
}
