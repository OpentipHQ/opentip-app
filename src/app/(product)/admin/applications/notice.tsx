export type ApplicationSearchParams = {
  approved?: string;
  rejected?: string;
  revoked?: string;
  resent?: string;
  invite?: "sent" | "skipped" | "failed";
  error?: string;
};

const ERROR_MESSAGES: Record<string, string> = {
  invalid: "The request was invalid.",
  unconfigured: "MARKETING_DATABASE_URL is not configured.",
  unavailable: "The marketing database could not complete the update. Try again.",
  "not-found": "The application was not found.",
  email: "The application email is invalid.",
  status: "This application was already reviewed. Refresh and check its current status.",
  database: "Local access could not be updated.",
  bootstrap: "This email is in ADMIN_EMAILS, so access remains controlled by the environment.",
  "partial-approve":
    "Local access was granted, but the marketing status did not update. Approve again to retry.",
  "partial-reject":
    "The application was rejected, but access could not be revoked. Use Revoke access to retry.",
};

function inviteCopy(invite: ApplicationSearchParams["invite"]): string {
  if (invite === "sent") return "The invite email was sent.";
  if (invite === "skipped") return "The invite email was skipped because email is not configured.";
  if (invite === "failed") return "The invite email failed. Use Resend invite to retry.";
  return "";
}

export function ApplicationNotice({ params }: { params: ApplicationSearchParams }) {
  const error = params.error ? ERROR_MESSAGES[params.error] ?? "The action could not be completed." : null;
  const invite = inviteCopy(params.invite);
  return (
    <>
      {params.approved ? (
        <p className="text-sm">
          Approved. Local access is ready.{invite ? ` ${invite}` : ""}
        </p>
      ) : null}
      {params.resent ? (
        <p className={params.invite === "failed" ? "text-sm text-destructive" : "text-sm"}>
          {params.invite === "sent"
            ? "Invite email sent."
            : params.invite === "skipped"
              ? "Invite email skipped because email is not configured."
              : "The invite email could not be sent. Check Resend and try again."}
        </p>
      ) : null}
      {params.rejected ? <p className="text-sm">Rejected. Local access was revoked.</p> : null}
      {params.revoked ? <p className="text-sm">Access revoked.</p> : null}
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </>
  );
}
