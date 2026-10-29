import { SubmitButton } from "@/components/ui/submit-button";
import type { MarketingApplicationStatus } from "@/lib/beta/marketing-applications";
import {
  approveApplication,
  rejectApplication,
  resendApplicationInvite,
  revokeApplicationAccess,
} from "./actions";

export function ReviewActions({
  id,
  status,
  hasAccess,
  bootstrapAdmin = false,
  returnTo,
  size = "default",
}: {
  id: string;
  status: MarketingApplicationStatus;
  hasAccess: boolean;
  bootstrapAdmin?: boolean;
  returnTo: string;
  size?: "sm" | "default";
}) {
  if (status === "pending") {
    return (
      <div className="flex flex-wrap gap-2">
        <form action={approveApplication}>
          <input type="hidden" name="id" value={id} />
          <input type="hidden" name="returnTo" value={returnTo} />
          <SubmitButton size={size} loadingText="Approving...">
            Approve
          </SubmitButton>
        </form>
        <form action={rejectApplication}>
          <input type="hidden" name="id" value={id} />
          <input type="hidden" name="returnTo" value={returnTo} />
          <SubmitButton size={size} variant="outline" loadingText="Rejecting...">
            Reject
          </SubmitButton>
        </form>
      </div>
    );
  }

  if (status === "approved") {
    return (
      <div className="flex flex-wrap gap-2">
        {!hasAccess ? (
          <form action={approveApplication}>
            <input type="hidden" name="id" value={id} />
            <input type="hidden" name="returnTo" value={returnTo} />
            <SubmitButton size={size} loadingText="Granting...">
              Grant access
            </SubmitButton>
          </form>
        ) : null}
        <form action={resendApplicationInvite}>
          <input type="hidden" name="id" value={id} />
          <input type="hidden" name="returnTo" value={returnTo} />
          <SubmitButton size={size} variant="outline" loadingText="Resending...">
            Resend invite
          </SubmitButton>
        </form>
      </div>
    );
  }

  if (status === "rejected" && hasAccess && !bootstrapAdmin) {
    return (
      <form action={revokeApplicationAccess}>
        <input type="hidden" name="id" value={id} />
        <input type="hidden" name="returnTo" value={returnTo} />
        <SubmitButton size={size} variant="destructive" loadingText="Revoking...">
          Revoke access
        </SubmitButton>
      </form>
    );
  }

  return null;
}
