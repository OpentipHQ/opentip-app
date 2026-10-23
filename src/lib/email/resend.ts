export type InviteEmailResult = {
  delivered: boolean;
  mode: "resend" | "skipped";
};

export async function sendBetaInviteEmail(args: {
  to: string;
  inviteUrl: string;
  env?: {
    RESEND_API_KEY?: string;
    RESEND_FROM?: string;
    NODE_ENV?: string;
  };
}): Promise<InviteEmailResult> {
  const env = args.env ?? process.env;
  const apiKey = env.RESEND_API_KEY;
  const from = env.RESEND_FROM;
  if (!apiKey || !from) {
    if (env.NODE_ENV === "production") {
      throw new Error("RESEND_API_KEY and RESEND_FROM are required in production");
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
      subject: "Your Opentip beta invite",
      text: `You are invited to the Opentip beta.\n\nSign in: ${args.inviteUrl}\n`,
    }),
  });
  if (!response.ok) {
    throw new Error(`Resend request failed (${response.status})`);
  }
  return { delivered: true, mode: "resend" };
}
