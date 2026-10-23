import { cookies } from "next/headers";
import { CodeScreen } from "@/components/auth/auth-screen";
import { EMAIL_CODE_USER, LOGIN_EMAIL_COOKIE } from "@/lib/auth/constants";
import { loginCodeCooldown } from "@/lib/auth/email-flow";
import { authErrors } from "@/lib/auth/messages";
import { normalizeEmail } from "@/lib/auth/login-code";
import { sessionSecret } from "@/lib/config";
import { verifySession } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function EnterCodePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;
  const secret = sessionSecret();
  const jar = await cookies();
  const pending = secret ? await verifySession(jar.get(LOGIN_EMAIL_COOKIE)?.value, secret) : null;
  const email =
    pending && pending.userId === EMAIL_CODE_USER ? normalizeEmail(pending.login) : null;
  const cooldown = email ? await loginCodeCooldown(email) : 0;
  return (
    <CodeScreen
      email={email}
      error={params.error ? (authErrors[params.error] ?? null) : null}
      cooldown={cooldown}
    />
  );
}
