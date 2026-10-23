import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { applyGithubGate } from "../src/lib/auth/gate";
import { issueLoginCode, verifyLoginCode } from "../src/lib/auth/email-flow";
import { isLocalDatabaseUrl } from "../src/lib/db-guard";
import { linkInstallForUser, createAppUser, findUserByEmail, findUserByGithubId, updateAppUser } from "../src/lib/auth/users";
import { storePendingInstall, readPendingInstall } from "../src/lib/auth/pending-store";

const url = process.env.DATABASE_URL ?? "";
if (!isLocalDatabaseUrl(url)) {
  console.error("Refusing to run: DATABASE_URL must point at localhost or 127.0.0.1.");
  process.exit(1);
}

const stamp = Date.now().toString(36);
const approvedEmail = `ada.${stamp}@example.com`;
const blockedEmail = `bea.${stamp}@example.com`;
const sinkDir = mkdtempSync(join(tmpdir(), "opentip-verify-"));
const sinkPath = join(sinkDir, "codes.log");
process.env.LOGIN_CODE_SINK = sinkPath;
(process.env as { NODE_ENV?: string }).NODE_ENV = "development";
process.env.SESSION_SECRET = process.env.SESSION_SECRET || "verify-session-secret";

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });
const failures: string[] = [];

function check(name: string, ok: boolean) {
  if (!ok) failures.push(name);
  console.log(`${ok ? "ok" : "FAIL"} ${name}`);
}

const installation = {
  githubInstallationId: `900${stamp}`.slice(0, 18),
  accountLogin: "ada",
  accountType: "User",
};
const repo = {
  githubRepoId: `800${stamp}`.replace(/\D/g, "").slice(0, 12) || "8001",
  owner: "ada",
  name: `docs${stamp}`.slice(0, 20),
  fullName: `ada/docs${stamp}`.slice(0, 40),
  private: false,
  defaultBranch: "main",
  archived: false,
};

async function main() {
  await prisma.betaAccess.create({ data: { email: approvedEmail } });
  const blocked = await issueLoginCode({ emailRaw: blockedEmail, ip: "127.0.0.1" });
  check("unapproved email is waitlisted", blocked.status === "waitlist");
  check(
    "unapproved email creates no user",
    (await prisma.user.count({ where: { email: blockedEmail } })) === 0,
  );
  check(
    "unapproved email stores no code",
    (await prisma.loginCode.count({ where: { email: blockedEmail } })) === 0,
  );

  const sent = await issueLoginCode({ emailRaw: approvedEmail, ip: "127.0.0.1" });
  check("approved email sends a code", sent.status === "sent");
  const sink = readFileSync(sinkPath, "utf8").trim().split("\n").at(-1) ?? "";
  const code = sink.split(" ")[1] ?? "";
  check("sink holds a 6-digit code", /^\d{6}$/.test(code));

  const wrong = await verifyLoginCode({ email: approvedEmail, code: "000000" });
  check("wrong code is rejected", wrong.status === "wrong");
  for (let attempt = 0; attempt < 4; attempt += 1) {
    await verifyLoginCode({ email: approvedEmail, code: "000000" });
  }
  const limited = await verifyLoginCode({ email: approvedEmail, code });
  check("too many attempts blocks the right code", limited.status === "too_many");
  check(
    "too many attempts creates no user",
    (await prisma.user.count({ where: { email: approvedEmail } })) === 0,
  );

  await prisma.loginCode.updateMany({
    where: { email: approvedEmail },
    data: { consumedAt: new Date(), attempts: 5 },
  });
  const resent = await issueLoginCode({
    emailRaw: approvedEmail,
    ip: "127.0.0.1",
    now: new Date(Date.now() + 61_000),
  });
  check("a new code can be sent after the cooldown", resent.status === "sent");
  const fresh = readFileSync(sinkPath, "utf8").trim().split("\n").at(-1)?.split(" ")[1] ?? "";
  await prisma.loginCode.updateMany({
    where: { email: approvedEmail, consumedAt: null },
    data: { expiresAt: new Date(Date.now() - 1000) },
  });
  const expired = await verifyLoginCode({ email: approvedEmail, code: fresh });
  check("expired code is rejected", expired.status === "expired");

  await prisma.loginCode.updateMany({
    where: { email: approvedEmail },
    data: { consumedAt: new Date() },
  });
  const again = await issueLoginCode({
    emailRaw: approvedEmail,
    ip: "127.0.0.1",
    now: new Date(Date.now() + 122_000),
  });
  check("code resent for a successful login", again.status === "sent");
  const good = readFileSync(sinkPath, "utf8").trim().split("\n").at(-1)?.split(" ")[1] ?? "";
  const signedIn = await verifyLoginCode({ email: approvedEmail, code: good });
  check("approved code signs in", signedIn.status === "ok");
  check(
    "email account exists",
    (await prisma.user.count({ where: { email: approvedEmail } })) === 1,
  );

  const sitesBefore = await prisma.site.count();
  const blockedInstall = await applyGithubGate(
    {
      ok: true,
      flow: "install",
      profile: {
        id: `gh-${stamp}`,
        login: "bea",
        name: "Bea",
        email: blockedEmail,
        avatarUrl: null,
      },
      inviteToken: null,
      installation,
      repos: [repo],
    },
    {
      hasAccess: async () => false,
      findUserByGithubId,
      findUserByEmail,
      createUser: createAppUser,
      updateUser: updateAppUser,
      savePending: storePendingInstall,
      link: linkInstallForUser,
      takePending: async () => null,
      markPendingConsumed: async () => undefined,
      existingSession: null,
    },
    null,
  );
  check("unapproved install has no session", blockedInstall.session === null && blockedInstall.redirect === "/waitlist");
  check("unapproved install creates no sites", (await prisma.site.count()) === sitesBefore);

  const held = await applyGithubGate(
    {
      ok: true,
      flow: "install",
      profile: {
        id: `gh-ada-${stamp}`,
        login: "ada",
        name: "Ada",
        email: approvedEmail,
        avatarUrl: null,
      },
      inviteToken: "invite-should-not-apply",
      installation: { ...installation, githubInstallationId: `${installation.githubInstallationId}2` },
      repos: [{ ...repo, githubRepoId: `${repo.githubRepoId}2`, name: `${repo.name}2` }],
    },
    {
      hasAccess: async () => true,
      findUserByGithubId,
      findUserByEmail,
      createUser: createAppUser,
      updateUser: updateAppUser,
      savePending: storePendingInstall,
      link: linkInstallForUser,
      takePending: async () => null,
      markPendingConsumed: async () => undefined,
      existingSession: null,
    },
    null,
  );
  check("approved direct install waits for sign-in", held.redirect === "/login?from=install" && held.session === null);
  check("approved direct install creates no sites yet", (await prisma.site.count()) === sitesBefore);
  check("held install saved a selector", Boolean(held.pendingSelector));
  const pending = await readPendingInstall(held.pendingSelector);
  check("held install can be read back", Boolean(pending));

  const linked = await applyGithubGate(
    {
      ok: true,
      flow: "sign-in",
      profile: {
        id: `gh-ada-${stamp}`,
        login: "ada",
        name: "Ada",
        email: approvedEmail,
        avatarUrl: null,
      },
      inviteToken: null,
      installation: null,
      repos: [],
    },
    {
      hasAccess: async () => true,
      findUserByGithubId,
      findUserByEmail,
      createUser: createAppUser,
      updateUser: updateAppUser,
      savePending: storePendingInstall,
      link: linkInstallForUser,
      takePending: async () => pending?.snapshot ?? null,
      markPendingConsumed: async () => undefined,
      existingSession: null,
    },
    "/dashboard",
  );
  check("later sign-in creates the site", linked.sitesCreated === 1 && linked.session !== null);
  const account = await prisma.user.findUnique({ where: { email: approvedEmail } });
  check("email and GitHub share one account", account?.githubId === `gh-ada-${stamp}`);
  check("one user row for that email", (await prisma.user.count({ where: { email: approvedEmail } })) === 1);
}

main()
  .catch((error: unknown) => {
    failures.push(error instanceof Error ? error.message : "verify failed");
    console.error(error);
  })
  .finally(async () => {
  await prisma.site.deleteMany({ where: { owner: { email: { in: [approvedEmail, blockedEmail] } } } });
  await prisma.repo.deleteMany({ where: { owner: "ada", name: { contains: stamp.slice(0, 6) } } });
  await prisma.installation.deleteMany({ where: { accountLogin: "ada", githubInstallationId: { contains: stamp.slice(0, 4) } } });
  await prisma.user.deleteMany({ where: { email: { in: [approvedEmail, blockedEmail] } } });
  await prisma.loginCode.deleteMany({ where: { email: { in: [approvedEmail, blockedEmail] } } });
  await prisma.pendingInstall.deleteMany({ where: { email: { in: [approvedEmail, blockedEmail] } } });
  await prisma.betaAccess.deleteMany({ where: { email: { in: [approvedEmail, blockedEmail] } } });
  await prisma.$disconnect();
  rmSync(sinkDir, { recursive: true, force: true });
  if (failures.length) {
    console.error(`Failed: ${failures.join(", ")}`);
    process.exit(1);
  }
  console.log("beta gate verified");
});
