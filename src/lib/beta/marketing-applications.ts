export type MarketingApplicationStatus = "pending" | "approved" | "rejected";

export type MarketingApplicationSummary = {
  id: string;
  name: string;
  email: string;
  githubUsername: string;
  xHandle: string | null;
  repoUrl: string;
  monthlyPayUsd: string | null;
  status: MarketingApplicationStatus;
  createdAt: string;
};

export type MarketingApplication = MarketingApplicationSummary & {
  projectSummary: string;
  docsReaders: string;
  docsTooling: string;
  docsPain: string;
  pushFrequency: string;
  feedbackCall: boolean;
  reviewedAt: string | null;
  reviewedBy: string | null;
};

export type MarketingApplicationsLoad =
  | { state: "ok"; applications: MarketingApplicationSummary[] }
  | { state: "unconfigured"; applications: [] }
  | { state: "unavailable"; applications: [] };

export type MarketingApplicationLoad =
  | { state: "ok"; application: MarketingApplication }
  | { state: "unconfigured" | "unavailable" | "not-found" };

export type MarketingApplicationCount =
  | { state: "ok"; count: number }
  | { state: "unconfigured" | "unavailable" };

export type MarketingReviewUpdate =
  | { state: "ok"; email: string; status: MarketingApplicationStatus }
  | { state: "unconfigured" | "unavailable" | "not-found" | "conflict" };

type Row = Record<string, unknown>;

function text(value: unknown): string {
  return typeof value === "string" ? value : value === null || value === undefined ? "" : String(value);
}

function optionalText(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const valueText = text(value);
  return valueText.length > 0 ? valueText : null;
}

function isoDate(value: unknown): string {
  const date = value instanceof Date ? value : new Date(text(value));
  return Number.isNaN(date.getTime()) ? "" : date.toISOString();
}

function optionalIsoDate(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  return isoDate(value);
}

export function normalizeMarketingStatus(value: unknown): MarketingApplicationStatus {
  const status = text(value).trim().toLowerCase();
  if (status === "approved" || status === "rejected") return status;
  return "pending";
}

export function isMarketingApplicationId(value: string): boolean {
  return /^\d{1,19}$/.test(value);
}

export function mapMarketingApplicationSummary(row: Row): MarketingApplicationSummary {
  return {
    id: text(row.id),
    name: text(row.name),
    email: text(row.email),
    githubUsername: text(row.github_username),
    xHandle: optionalText(row.x_handle),
    repoUrl: text(row.repo_url),
    monthlyPayUsd: optionalText(row.monthly_pay_usd),
    status: normalizeMarketingStatus(row.status),
    createdAt: isoDate(row.created_at),
  };
}

export function mapMarketingApplication(row: Row): MarketingApplication {
  return {
    ...mapMarketingApplicationSummary(row),
    projectSummary: text(row.project_summary),
    docsReaders: text(row.docs_readers),
    docsTooling: text(row.docs_tooling),
    docsPain: text(row.docs_pain),
    pushFrequency: text(row.push_frequency),
    feedbackCall: row.feedback_call === true,
    reviewedAt: optionalIsoDate(row.reviewed_at),
    reviewedBy: optionalText(row.reviewed_by),
  };
}

export function formatMonthlyPay(value: string | null): string {
  if (value === null) return "Not answered";
  const amount = Number(value);
  if (!Number.isFinite(amount)) return "Not answered";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount);
}

export function formatApplicationDate(value: string): string {
  if (!value) return "Unknown";
  return value.slice(0, 10);
}
