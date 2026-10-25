import { Pool, type PoolConfig } from "pg";
import {
  isMarketingApplicationId,
  mapMarketingApplication,
  mapMarketingApplicationSummary,
  type MarketingApplicationCount,
  type MarketingApplicationLoad,
  type MarketingApplicationsLoad,
  type MarketingReviewUpdate,
} from "@/lib/beta/marketing-applications";

const globalForMarketing = globalThis as unknown as { marketingPool?: Pool };

const SUMMARY_COLUMNS = `
  id::text,
  name,
  email,
  github_username,
  x_handle,
  repo_url,
  monthly_pay_usd,
  status,
  created_at
`;

const APPLICATION_COLUMNS = `
  ${SUMMARY_COLUMNS},
  project_summary,
  docs_readers,
  docs_tooling,
  docs_pain,
  push_frequency,
  feedback_call,
  reviewed_at,
  reviewed_by
`;

function connectionConfig(): PoolConfig | null {
  const raw = process.env.MARKETING_DATABASE_URL?.trim();
  if (!raw) return null;
  try {
    const url = new URL(raw);
    url.searchParams.delete("sslmode");
    url.searchParams.delete("channel_binding");
    url.searchParams.delete("uselibpqcompat");
    return {
      connectionString: url.toString(),
      ssl: { rejectUnauthorized: true },
    };
  } catch {
    return { connectionString: raw, ssl: { rejectUnauthorized: true } };
  }
}

export function marketingDatabaseConfigured(): boolean {
  return Boolean(process.env.MARKETING_DATABASE_URL?.trim());
}

function getMarketingPool(): Pool | null {
  const config = connectionConfig();
  if (!config) return null;
  if (!globalForMarketing.marketingPool) {
    globalForMarketing.marketingPool = new Pool({
      ...config,
      max: 3,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 15_000,
      query_timeout: 15_000,
      statement_timeout: 15_000,
      application_name: "opentip-admin",
    });
    globalForMarketing.marketingPool.on("error", (error) => {
      console.error("Marketing database pool error", error.message);
    });
  }
  return globalForMarketing.marketingPool;
}

function logFailure(operation: string, error: unknown): void {
  console.error(`Marketing applications ${operation} failed`, error instanceof Error ? error.message : "unknown error");
}

export async function loadMarketingApplications(limit = 50): Promise<MarketingApplicationsLoad> {
  const pool = getMarketingPool();
  if (!pool) return { state: "unconfigured", applications: [] };
  const boundedLimit = Math.min(Math.max(Math.trunc(limit), 1), 100);
  try {
    const result = await pool.query(
      `SELECT ${SUMMARY_COLUMNS}
       FROM beta_application
       ORDER BY created_at DESC
       LIMIT $1`,
      [boundedLimit],
    );
    return {
      state: "ok",
      applications: result.rows.map((row) => mapMarketingApplicationSummary(row)),
    };
  } catch (error) {
    logFailure("list", error);
    return { state: "unavailable", applications: [] };
  }
}

export async function loadMarketingApplication(id: string): Promise<MarketingApplicationLoad> {
  if (!isMarketingApplicationId(id)) return { state: "not-found" };
  const pool = getMarketingPool();
  if (!pool) return { state: "unconfigured" };
  try {
    const result = await pool.query(
      `SELECT ${APPLICATION_COLUMNS}
       FROM beta_application
       WHERE id = $1::bigint`,
      [id],
    );
    const row = result.rows[0];
    if (!row) return { state: "not-found" };
    return { state: "ok", application: mapMarketingApplication(row) };
  } catch (error) {
    logFailure("read", error);
    return { state: "unavailable" };
  }
}

export async function countMarketingApplications(): Promise<MarketingApplicationCount> {
  const pool = getMarketingPool();
  if (!pool) return { state: "unconfigured" };
  try {
    const result = await pool.query("SELECT count(*) AS total FROM beta_application");
    return { state: "ok", count: Number(result.rows[0]?.total ?? 0) };
  } catch (error) {
    logFailure("count", error);
    return { state: "unavailable" };
  }
}

async function reviewMarketingApplication(
  id: string,
  status: "approved" | "rejected",
  reviewer: string,
): Promise<MarketingReviewUpdate> {
  if (!isMarketingApplicationId(id)) return { state: "not-found" };
  const pool = getMarketingPool();
  if (!pool) return { state: "unconfigured" };
  try {
    const result = await pool.query(
      `UPDATE beta_application
       SET status = $2, reviewed_at = now(), reviewed_by = $3
       WHERE id = $1::bigint AND status = 'pending'
       RETURNING email, status`,
      [id, status, reviewer.slice(0, 200)],
    );
    const row = result.rows[0];
    if (!row) return { state: "conflict" };
    return {
      state: "ok",
      email: String(row.email),
      status: status,
    };
  } catch (error) {
    logFailure(status === "approved" ? "approve" : "reject", error);
    return { state: "unavailable" };
  }
}

export function approveMarketingApplication(id: string, reviewer: string): Promise<MarketingReviewUpdate> {
  return reviewMarketingApplication(id, "approved", reviewer);
}

export function rejectMarketingApplication(id: string, reviewer: string): Promise<MarketingReviewUpdate> {
  return reviewMarketingApplication(id, "rejected", reviewer);
}
