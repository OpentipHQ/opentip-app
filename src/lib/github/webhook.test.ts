import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { MemoryWebhookRepository } from "@/lib/github/memory-repository";
import { signGithubBody, verifyGithubSignature } from "@/lib/github/signature";
import { handleGithubWebhook } from "@/lib/github/webhook";

const SECRET = "test-webhook-secret";

function signed(body: string, secret = SECRET) {
  return {
    rawBody: body,
    headers: {
      deliveryId: "delivery-1",
      event: "push",
      signature: signGithubBody(body, secret),
    },
  };
}

function repoWithSite() {
  const repo = new MemoryWebhookRepository();
  repo.repos.set("42", {
    id: "repo_1",
    githubRepoId: "42",
    fullName: "acme/docs",
    owner: "acme",
    name: "docs",
    installationGithubId: "7",
  });
  repo.sites.push({
    repoGithubId: "42",
    installationGithubId: "7",
    status: "ACTIVE",
    pausedReason: null,
  });
  repo.installations.set("7", {
    accountLogin: "acme",
    accountType: "Organization",
    uninstalled: false,
  });
  return repo;
}

describe("github webhook signature", () => {
  it("accepts a matching sha256 signature", () => {
    const body = JSON.stringify({ zen: "keep" });
    const signature = signGithubBody(body, SECRET);
    expect(verifyGithubSignature(body, signature, SECRET)).toBe(true);
  });

  it("rejects a missing, short, or swapped signature", () => {
    const body = JSON.stringify({ zen: "keep" });
    expect(verifyGithubSignature(body, null, SECRET)).toBe(false);
    expect(verifyGithubSignature(body, "sha256=abc", SECRET)).toBe(false);
    expect(verifyGithubSignature(body, signGithubBody(body, "other"), SECRET)).toBe(false);
    expect(verifyGithubSignature(`${body} `, signGithubBody(body, SECRET), SECRET)).toBe(false);
    expect(verifyGithubSignature(body, signGithubBody(body, SECRET), "")).toBe(false);
  });

  it("matches the hex hmac GitHub sends", () => {
    const body = "{\"ok\":true}";
    const expected =
      "sha256=" + createHmac("sha256", SECRET).update(body).digest("hex");
    expect(signGithubBody(body, SECRET)).toBe(expected);
  });
});

describe("github webhook idempotency", () => {
  it("enqueues one push job when the same delivery arrives twice", async () => {
    const repo = repoWithSite();
    const body = JSON.stringify({
      ref: "refs/heads/main",
      before: "a".repeat(40),
      after: "b".repeat(40),
      repository: { id: 42, full_name: "acme/docs" },
    });
    const first = await handleGithubWebhook({ ...signed(body), secret: SECRET, repo });
    const second = await handleGithubWebhook({ ...signed(body), secret: SECRET, repo });
    expect(first.status).toBe(200);
    expect(first.body).toMatchObject({ ok: true, duplicate: false, jobId: "job_1" });
    expect(second.status).toBe(200);
    expect(second.body).toMatchObject({ ok: true, duplicate: true });
    expect(repo.jobs).toHaveLength(1);
    expect(repo.jobs[0]?.idempotencyKey).toBe(`push:42:${"b".repeat(40)}`);
  });

  it("keeps a single job when a new delivery repeats the same commit", async () => {
    const repo = repoWithSite();
    const body = JSON.stringify({
      after: "c".repeat(40),
      repository: { id: 42, full_name: "acme/docs" },
    });
    const first = signed(body);
    const second = signed(body);
    second.headers.deliveryId = "delivery-2";
    await handleGithubWebhook({ ...first, secret: SECRET, repo });
    const repeat = await handleGithubWebhook({ ...second, secret: SECRET, repo });
    expect(repeat.body).toMatchObject({ ok: true, duplicate: false, jobId: "job_1" });
    expect(repo.jobs).toHaveLength(1);
    expect(repo.deliveries.size).toBe(2);
  });

  it("does not record a delivery when the signature is bad", async () => {
    const repo = repoWithSite();
    const body = JSON.stringify({ after: "d".repeat(40), repository: { id: 42 } });
    const result = await handleGithubWebhook({
      rawBody: body,
      headers: {
        deliveryId: "delivery-x",
        event: "push",
        signature: "sha256=deadbeef",
      },
      secret: SECRET,
      repo,
    });
    expect(result.status).toBe(401);
    expect(repo.deliveries.size).toBe(0);
    expect(repo.jobs).toHaveLength(0);
  });

  it("releases the delivery when enqueue fails so a retry can succeed", async () => {
    const repo = repoWithSite();
    repo.failEnqueueOnce = true;
    const body = JSON.stringify({
      after: "e".repeat(40),
      repository: { id: 42 },
    });
    const request = signed(body);
    const failed = await handleGithubWebhook({ ...request, secret: SECRET, repo });
    const retried = await handleGithubWebhook({ ...request, secret: SECRET, repo });
    expect(failed.status).toBe(500);
    expect(retried.status).toBe(200);
    expect(repo.jobs).toHaveLength(1);
  });

  it("ignores pushes to non-default branches and tags", async () => {
    const repo = repoWithSite();
    const branch = JSON.stringify({
      ref: "refs/heads/dev",
      before: "a".repeat(40),
      after: "b".repeat(40),
      repository: { id: 42 },
    });
    const tag = JSON.stringify({
      ref: "refs/tags/v1.0.0",
      before: "a".repeat(40),
      after: "b".repeat(40),
      repository: { id: 42 },
    });
    const tagRequest = signed(tag);
    tagRequest.headers.deliveryId = "delivery-tag";
    const first = await handleGithubWebhook({ ...signed(branch), secret: SECRET, repo });
    const second = await handleGithubWebhook({ ...tagRequest, secret: SECRET, repo });
    expect(first.body).toMatchObject({ ok: true, ignored: true });
    expect(second.body).toMatchObject({ ok: true, ignored: true });
    expect(repo.jobs).toHaveLength(0);
  });

  it("allows a configured default branch", async () => {
    const repo = repoWithSite();
    repo.repos.set("42", {
      ...repo.repos.get("42")!,
      defaultBranch: "develop",
    });
    const body = JSON.stringify({
      ref: "refs/heads/develop",
      before: "a".repeat(40),
      after: "b".repeat(40),
      repository: { id: 42 },
    });
    const result = await handleGithubWebhook({ ...signed(body), secret: SECRET, repo });
    expect(result.body).toMatchObject({ ok: true, jobId: "job_1" });
  });

  it("ignores pushes when the site is paused or missing", async () => {
    const paused = repoWithSite();
    paused.sites[0]!.status = "PAUSED";
    const noSite = new MemoryWebhookRepository();
    noSite.repos.set("42", {
      id: "repo_1",
      githubRepoId: "42",
      fullName: "acme/docs",
      owner: "acme",
      name: "docs",
      installationGithubId: "7",
    });
    const body = JSON.stringify({
      ref: "refs/heads/main",
      before: "a".repeat(40),
      after: "b".repeat(40),
      repository: { id: 42 },
    });
    const first = await handleGithubWebhook({ ...signed(body), secret: SECRET, repo: paused });
    const second = await handleGithubWebhook({ ...signed(body), secret: SECRET, repo: noSite });
    expect(first.body).toMatchObject({ ok: true, ignored: true });
    expect(second.body).toMatchObject({ ok: true, ignored: true });
    expect(paused.jobs).toHaveLength(0);
    expect(noSite.jobs).toHaveLength(0);
  });

  it("pauses the site when the GitHub App is uninstalled", async () => {
    const repo = repoWithSite();
    const body = JSON.stringify({
      action: "deleted",
      installation: { id: 7, account: { login: "acme", type: "Organization" } },
    });
    const request = signed(body);
    request.headers.event = "installation";
    const result = await handleGithubWebhook({ ...request, secret: SECRET, repo });
    expect(result.body).toMatchObject({ ok: true, paused: 1 });
    expect(repo.sites[0]).toMatchObject({
      status: "PAUSED",
      pausedReason: "github_app_uninstalled",
    });
    const again = await handleGithubWebhook({ ...request, secret: SECRET, repo });
    expect(again.body).toMatchObject({ duplicate: true });
    expect(repo.sites[0]?.status).toBe("PAUSED");
  });

  it("pauses a repo that was removed from the installation", async () => {
    const repo = repoWithSite();
    const body = JSON.stringify({
      action: "removed",
      installation: { id: 7 },
      repositories_removed: [{ id: 42 }],
    });
    const request = signed(body);
    request.headers.event = "installation_repositories";
    const result = await handleGithubWebhook({ ...request, secret: SECRET, repo });
    expect(result.body).toMatchObject({ paused: 1 });
    expect(repo.sites[0]?.pausedReason).toBe("repo_removed");
  });
});
