export type EmailDelivery = {
  delivered: boolean;
  mode: "resend" | "skipped";
};

export type EmailEnv = {
  RESEND_API_KEY?: string;
  RESEND_FROM?: string;
  NODE_ENV?: string;
  APP_URL?: string;
};

export type EmailTag = {
  name: string;
  value: string;
};

export async function sendEmail(args: {
  to: string[];
  subject: string;
  html: string;
  text: string;
  tags?: EmailTag[];
  headers?: Record<string, string>;
  env?: EmailEnv;
}): Promise<EmailDelivery> {
  const env = args.env ?? process.env;
  const apiKey = env.RESEND_API_KEY;
  const from = env.RESEND_FROM;
  if (!apiKey || !from || args.to.length === 0) {
    if (env.NODE_ENV === "production") {
      throw new Error("RESEND_API_KEY, RESEND_FROM, and a recipient are required in production");
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
      to: args.to,
      subject: args.subject,
      html: args.html,
      text: args.text,
      ...(args.tags?.length ? { tags: args.tags } : {}),
      ...(args.headers && Object.keys(args.headers).length ? { headers: args.headers } : {}),
    }),
  });
  if (!response.ok) {
    throw new Error(`Resend request failed (${response.status})`);
  }
  return { delivered: true, mode: "resend" };
}
