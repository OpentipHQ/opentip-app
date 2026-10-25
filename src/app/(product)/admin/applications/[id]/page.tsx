import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/shell/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { isBootstrapAdmin } from "@/lib/beta/admins";
import { hasBetaAccess } from "@/lib/beta/access";
import {
  formatApplicationDate,
  formatMonthlyPay,
  type MarketingApplicationStatus,
} from "@/lib/beta/marketing-applications";
import { loadMarketingApplication } from "@/lib/beta/marketing-db";
import { ApplicationNotice, type ApplicationSearchParams } from "../notice";
import { ReviewActions } from "../review-actions";

export const dynamic = "force-dynamic";

const STATUS_LABELS = {
  pending: "Pending",
  approved: "Approved",
  rejected: "Rejected",
} as const;

const STATUS_VARIANTS = {
  pending: "secondary",
  approved: "default",
  rejected: "destructive",
} as const;

function safeHttpUrl(value: string): string | null {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

function Definition({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-1 break-words">{children}</dd>
    </div>
  );
}

function StatusBadge({ status }: { status: MarketingApplicationStatus }) {
  return <Badge variant={STATUS_VARIANTS[status]}>{STATUS_LABELS[status]}</Badge>;
}

export default async function ApplicationPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<ApplicationSearchParams>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const result = await loadMarketingApplication(id);
  if (result.state === "not-found") notFound();

  const back = (
    <Button nativeButton={false} variant="outline" render={<Link href="/admin/applications" />}>
      Back
    </Button>
  );

  if (result.state !== "ok") {
    return (
      <>
        <PageHeader title="Application" description="Review a beta application." action={back} />
        <Empty className="border border-border bg-card">
          <EmptyHeader>
            <EmptyTitle>
              {result.state === "unconfigured"
                ? "Applications database is not configured"
                : "Application is unavailable"}
            </EmptyTitle>
            <EmptyDescription>
              {result.state === "unconfigured"
                ? "Set MARKETING_DATABASE_URL to read the marketing site applications."
                : "The marketing database could not be reached. Other admin pages still work."}
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      </>
    );
  }

  const application = result.application;
  const access = await hasBetaAccess(application.email);
  const bootstrapAdmin = isBootstrapAdmin(application.email);
  const repoUrl = safeHttpUrl(application.repoUrl);
  const githubUsername = application.githubUsername.replace(/^@/, "");
  const xHandle = application.xHandle?.replace(/^@/, "") ?? null;

  return (
    <>
      <PageHeader
        title={application.name}
        description={application.email}
        action={
          <div className="flex flex-wrap gap-2">
            {back}
            <ReviewActions
              id={application.id}
              status={application.status}
              hasAccess={access}
              bootstrapAdmin={bootstrapAdmin}
              returnTo={`/admin/applications/${application.id}`}
            />
          </div>
        }
      />
      <ApplicationNotice params={query} />

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Status</CardTitle>
          </CardHeader>
          <CardContent>
            <StatusBadge status={application.status} />
            <p className="mt-2 text-sm text-muted-foreground">
              {application.reviewedAt
                ? `Reviewed ${formatApplicationDate(application.reviewedAt)} by ${application.reviewedBy ?? "an admin"}`
                : "Not reviewed"}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>App access</CardTitle>
          </CardHeader>
          <CardContent>
            <Badge variant={access ? "default" : "secondary"}>{access ? "Granted" : "Not granted"}</Badge>
            <p className="mt-2 text-sm text-muted-foreground">
              {bootstrapAdmin
                ? "This email stays approved through ADMIN_EMAILS."
                : "Access is stored in this app. Review decisions are stored in the marketing database."}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Price answer</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm">{formatMonthlyPay(application.monthlyPayUsd)}</p>
            <p className="mt-2 text-sm text-muted-foreground">
              Feedback call: {application.feedbackCall ? "Yes" : "No"}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Application</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-4 sm:grid-cols-2">
            <Definition label="Name">{application.name}</Definition>
            <Definition label="Email">{application.email}</Definition>
            <Definition label="GitHub">
              <Link
                className="underline underline-offset-4"
                href={`https://github.com/${encodeURIComponent(githubUsername)}`}
                target="_blank"
                rel="noreferrer"
              >
                @{githubUsername}
              </Link>
            </Definition>
            <Definition label="X handle">
              {xHandle ? (
                <Link
                  className="underline underline-offset-4"
                  href={`https://x.com/${encodeURIComponent(xHandle)}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  @{xHandle}
                </Link>
              ) : (
                "Not provided"
              )}
            </Definition>
            <Definition label="Repo">
              {repoUrl ? (
                <Link
                  className="break-all underline underline-offset-4"
                  href={repoUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  {application.repoUrl}
                </Link>
              ) : (
                application.repoUrl || "Not provided"
              )}
            </Definition>
            <Definition label="Push frequency">{application.pushFrequency}</Definition>
            <Definition label="Applied">{formatApplicationDate(application.createdAt)}</Definition>
            <Definition label="Feedback call">{application.feedbackCall ? "Yes" : "No"}</Definition>
          </dl>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Project</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="whitespace-pre-wrap text-sm leading-6">{application.projectSummary}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Docs today</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-xs text-muted-foreground">Readers</p>
              <p className="mt-1 whitespace-pre-wrap text-sm leading-6">{application.docsReaders}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Tooling</p>
              <p className="mt-1 whitespace-pre-wrap text-sm leading-6">{application.docsTooling}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Biggest docs pain</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="whitespace-pre-wrap text-sm leading-6">{application.docsPain}</p>
        </CardContent>
      </Card>
    </>
  );
}
