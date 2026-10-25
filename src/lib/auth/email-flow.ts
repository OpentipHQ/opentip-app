import { sessionSecret } from "@/lib/config";
import { getPrisma } from "@/lib/db";
import { hasBetaAccess } from "@/lib/beta/access";
import { decideAccountLink, loginFromEmail, type ExistingUser } from "@/lib/auth/accounts";
import {
  assessLoginCode,
  cooldownRemaining,
  hashIp,
  hourAgo,
  normalizeEmail,
  planLoginCode,
} from "@/lib/auth/login-code";
import { sendLoginCodeEmail } from "@/lib/email/login-code-mail";
import { createAppUser, findUserByEmail, updateAppUser } from "@/lib/auth/users";

export type IssueResult =
  | { status: "invalid" | "waitlist" | "cooldown" | "rate" | "unconfigured" | "database" | "session" }
  | { status: "sent" };

export type VerifyResult =
  | { status: "ok"; user: ExistingUser }
  | {
      status:
        | "database"
        | "session"
        | "expired"
        | "wrong"
        | "too_many"
        | "missing"
        | "used"
        | "waitlist"
        | "suspended";
    };

function codeSecret(): string | null {
  return sessionSecret();
}

export async function issueLoginCode(args: {
  emailRaw: string;
  ip: string;
  now?: Date;
}): Promise<IssueResult> {
  const email = normalizeEmail(args.emailRaw);
  if (!email) return { status: "invalid" };
  const secret = codeSecret();
  if (!secret) return { status: "session" };
  const prisma = getPrisma();
  if (!prisma) return { status: "database" };
  const now = args.now ?? new Date();
  const approved = await hasBetaAccess(email);
  const since = hourAgo(now);
  const ipHash = hashIp(args.ip || "local", secret);
  const [recentEmailCount, recentIpCount, latest] = await Promise.all([
    prisma.loginCode.count({ where: { email, createdAt: { gte: since } } }),
    prisma.loginCode.count({ where: { ipHash, createdAt: { gte: since } } }),
    prisma.loginCode.findFirst({
      where: { email },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true },
    }),
  ]);
  const plan = planLoginCode({
    approved,
    recentEmailCount,
    recentIpCount,
    lastSentAt: latest?.createdAt ?? null,
    now,
    email,
    secret,
  });
  if (!plan.ok) return { status: plan.reason };
  let sent: { mode: string };
  try {
    sent = await sendLoginCodeEmail({ to: email, code: plan.code });
  } catch {
    return { status: "unconfigured" };
  }
  if (sent.mode === "skipped") return { status: "unconfigured" };
  await prisma.loginCode.create({
    data: {
      email,
      codeHash: plan.codeHash,
      expiresAt: plan.expiresAt,
      ipHash,
    },
  });
  return { status: "sent" };
}

export async function verifyLoginCode(args: {
  email: string;
  code: string;
  now?: Date;
}): Promise<VerifyResult> {
  const email = normalizeEmail(args.email);
  if (!email) return { status: "missing" };
  const secret = codeSecret();
  if (!secret) return { status: "session" };
  const prisma = getPrisma();
  if (!prisma) return { status: "database" };
  const now = args.now ?? new Date();
  const row = await prisma.loginCode.findFirst({
    where: { email, purpose: "signin" },
    orderBy: { createdAt: "desc" },
  });
  const verdict = assessLoginCode({
    row: row
      ? {
          codeHash: row.codeHash,
          expiresAt: row.expiresAt,
          attempts: row.attempts,
          consumedAt: row.consumedAt,
        }
      : null,
    code: args.code,
    email,
    secret,
    now,
  });
  if (!verdict.ok) {
    if (verdict.increment && row) {
      await prisma.loginCode.update({
        where: { id: row.id },
        data: { attempts: { increment: 1 } },
      });
    }
    return { status: verdict.reason };
  }
  if (!row) return { status: "missing" };
  const consumed = await prisma.loginCode.updateMany({
    where: { id: row.id, consumedAt: null },
    data: { consumedAt: now },
  });
  if (consumed.count !== 1) return { status: "used" };
  if (!(await hasBetaAccess(email))) return { status: "waitlist" };
  const byEmail = await findUserByEmail(email);
  const profile = {
    githubId: null,
    login: loginFromEmail(email),
    name: null,
    email,
    avatarUrl: null,
  };
  const decision = decideAccountLink({ profile, byGithub: null, byEmail });
  if (decision.kind === "conflict") return { status: "missing" };
  const user =
    decision.kind === "create"
      ? await createAppUser(decision.data)
      : await updateAppUser(decision.id, decision.data);
  if (user.suspendedAt) return { status: "suspended" };
  return { status: "ok", user };
}

export async function issueEmailChangeCode(args: {
  userId: string;
  emailRaw: string;
  now?: Date;
}): Promise<IssueResult> {
  const email = normalizeEmail(args.emailRaw);
  if (!email) return { status: "invalid" };
  const secret = codeSecret();
  if (!secret) return { status: "session" };
  const prisma = getPrisma();
  if (!prisma) return { status: "database" };
  const now = args.now ?? new Date();
  const since = hourAgo(now);
  const [recentEmailCount, latest] = await Promise.all([
    prisma.loginCode.count({ where: { email, createdAt: { gte: since } } }),
    prisma.loginCode.findFirst({
      where: { email },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true },
    }),
  ]);
  const plan = planLoginCode({
    approved: true,
    recentEmailCount,
    recentIpCount: 0,
    lastSentAt: latest?.createdAt ?? null,
    now,
    email,
    secret,
  });
  if (!plan.ok) return { status: plan.reason };
  let sent: { mode: string };
  try {
    sent = await sendLoginCodeEmail({
      to: email,
      code: plan.code,
      purpose: "email-change",
    });
  } catch {
    return { status: "unconfigured" };
  }
  if (sent.mode === "skipped") return { status: "unconfigured" };
  await prisma.loginCode.create({
    data: {
      email,
      codeHash: plan.codeHash,
      purpose: "email-change",
      userId: args.userId,
      expiresAt: plan.expiresAt,
    },
  });
  return { status: "sent" };
}

export async function verifyEmailChangeCode(args: {
  userId: string;
  emailRaw: string;
  code: string;
  now?: Date;
}): Promise<"ok" | "missing" | "expired" | "wrong" | "too_many" | "database" | "session" | "used"> {
  const email = normalizeEmail(args.emailRaw);
  if (!email) return "missing";
  const secret = codeSecret();
  if (!secret) return "session";
  const prisma = getPrisma();
  if (!prisma) return "database";
  const now = args.now ?? new Date();
  const row = await prisma.loginCode.findFirst({
    where: { email, userId: args.userId, purpose: "email-change" },
    orderBy: { createdAt: "desc" },
  });
  const verdict = assessLoginCode({
    row: row
      ? {
          codeHash: row.codeHash,
          expiresAt: row.expiresAt,
          attempts: row.attempts,
          consumedAt: row.consumedAt,
        }
      : null,
    code: args.code,
    email,
    secret,
    now,
  });
  if (!verdict.ok) {
    if (verdict.increment && row) {
      await prisma.loginCode.update({
        where: { id: row.id },
        data: { attempts: { increment: 1 } },
      });
    }
    return verdict.reason;
  }
  if (!row) return "missing";
  const consumed = await prisma.loginCode.updateMany({
    where: { id: row.id, consumedAt: null },
    data: { consumedAt: now },
  });
  return consumed.count === 1 ? "ok" : "used";
}

export async function loginCodeCooldown(email: string, now = new Date()): Promise<number> {
  const prisma = getPrisma();
  if (!prisma) return 0;
  const latest = await prisma.loginCode.findFirst({
    where: { email },
    orderBy: { createdAt: "desc" },
    select: { createdAt: true },
  });
  return cooldownRemaining(latest?.createdAt ?? null, now);
}
