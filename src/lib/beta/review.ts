import { normalizeEmail } from "@/lib/auth/login-code";
import {
  isMarketingApplicationId,
  type MarketingApplicationLoad,
  type MarketingReviewUpdate,
} from "@/lib/beta/marketing-applications";

export type ReviewDeps = {
  marketing: {
    get: (id: string) => Promise<MarketingApplicationLoad>;
    approve: (id: string, reviewer: string) => Promise<MarketingReviewUpdate>;
    reject: (id: string, reviewer: string) => Promise<MarketingReviewUpdate>;
  };
  access: {
    grant: (email: string) => Promise<"granted" | "invalid" | "no-database">;
    revoke: (email: string) => Promise<"revoked" | "invalid" | "no-database" | "bootstrap">;
  };
  notify: {
    approval: (email: string) => Promise<"sent" | "skipped">;
  };
};

export type ApprovalEmailDelivery = "sent" | "skipped" | "failed";

export type ReviewFailure =
  | "invalid"
  | "unconfigured"
  | "unavailable"
  | "not-found"
  | "email"
  | "status"
  | "database"
  | "bootstrap"
  | "partial-approve"
  | "partial-reject";

export type ReviewResult =
  | {
      ok: true;
      outcome: "approved" | "rejected" | "revoked";
      applicationId: string;
      email: string;
      approvalEmail?: ApprovalEmailDelivery;
    }
  | {
      ok: false;
      reason: ReviewFailure;
      applicationId?: string;
      email?: string;
    };

function failure(reason: ReviewFailure, applicationId?: string, email?: string): ReviewResult {
  return { ok: false, reason, applicationId, email };
}

function marketingFailure(state: "unconfigured" | "unavailable" | "not-found"): ReviewFailure {
  return state;
}

function updateFailure(state: "unconfigured" | "unavailable" | "not-found" | "conflict"): ReviewFailure {
  return state === "conflict" ? "status" : state;
}

export async function approveBetaApplication(
  input: { id: string; reviewer: string },
  deps: ReviewDeps,
): Promise<ReviewResult> {
  if (!isMarketingApplicationId(input.id)) return failure("invalid");
  const loaded = await deps.marketing.get(input.id);
  if (loaded.state !== "ok") return failure(marketingFailure(loaded.state));

  const email = normalizeEmail(loaded.application.email);
  if (!email) return failure("email", input.id);
  if (loaded.application.status === "rejected") {
    return failure("status", input.id, email);
  }

  let granted: "granted" | "invalid" | "no-database";
  try {
    granted = await deps.access.grant(email);
  } catch {
    return failure("database", input.id, email);
  }
  if (granted !== "granted") {
    return failure(granted === "invalid" ? "email" : "database", input.id, email);
  }

  if (loaded.application.status === "approved") {
    return { ok: true, outcome: "approved", applicationId: input.id, email };
  }

  const updated = await deps.marketing.approve(input.id, input.reviewer);
  if (updated.state !== "ok") {
    return failure("partial-approve", input.id, email);
  }

  let approvalEmail: ApprovalEmailDelivery;
  try {
    approvalEmail = await deps.notify.approval(email);
  } catch {
    approvalEmail = "failed";
  }

  return { ok: true, outcome: "approved", applicationId: input.id, email, approvalEmail };
}

export async function rejectBetaApplication(
  input: { id: string; reviewer: string },
  deps: ReviewDeps,
): Promise<ReviewResult> {
  if (!isMarketingApplicationId(input.id)) return failure("invalid");
  const loaded = await deps.marketing.get(input.id);
  if (loaded.state !== "ok") return failure(marketingFailure(loaded.state));

  const email = normalizeEmail(loaded.application.email);
  if (!email) return failure("email", input.id);
  if (loaded.application.status !== "pending") {
    return failure("status", input.id, email);
  }

  const updated = await deps.marketing.reject(input.id, input.reviewer);
  if (updated.state !== "ok") {
    return failure(updateFailure(updated.state), input.id, email);
  }

  let revoked: "revoked" | "invalid" | "no-database" | "bootstrap";
  try {
    revoked = await deps.access.revoke(email);
  } catch {
    return failure("partial-reject", input.id, email);
  }
  if (revoked === "bootstrap") return failure("bootstrap", input.id, email);
  if (revoked !== "revoked") return failure("partial-reject", input.id, email);

  return { ok: true, outcome: "rejected", applicationId: input.id, email };
}

export async function revokeBetaApplicationAccess(
  input: { id: string },
  deps: Pick<ReviewDeps, "marketing" | "access">,
): Promise<ReviewResult> {
  if (!isMarketingApplicationId(input.id)) return failure("invalid");
  const loaded = await deps.marketing.get(input.id);
  if (loaded.state !== "ok") return failure(marketingFailure(loaded.state));

  const email = normalizeEmail(loaded.application.email);
  if (!email) return failure("email", input.id);
  if (loaded.application.status !== "rejected") {
    return failure("status", input.id, email);
  }

  let revoked: "revoked" | "invalid" | "no-database" | "bootstrap";
  try {
    revoked = await deps.access.revoke(email);
  } catch {
    return failure("database", input.id, email);
  }
  if (revoked === "bootstrap") return failure("bootstrap", input.id, email);
  if (revoked !== "revoked") return failure("database", input.id, email);

  return { ok: true, outcome: "revoked", applicationId: input.id, email };
}
