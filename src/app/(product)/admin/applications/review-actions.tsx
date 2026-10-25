import { Button } from "@/components/ui/button";
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
          <Button type="submit" size={size}>
            Approve
          </Button>
        </form>
        <form action={rejectApplication}>
          <input type="hidden" name="id" value={id} />
          <input type="hidden" name="returnTo" value={returnTo} />
          <Button type="submit" size={size} variant="outline">
            Reject
          </Button>
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
            <Button type="submit" size={size}>
              Grant access
            </Button>
          </form>
        ) : null}
        <form action={resendApplicationInvite}>
          <input type="hidden" name="id" value={id} />
          <input type="hidden" name="returnTo" value={returnTo} />
          <Button type="submit" size={size} variant="outline">
            Resend invite
          </Button>
        </form>
      </div>
    );
  }

  if (status === "rejected" && hasAccess && !bootstrapAdmin) {
    return (
      <form action={revokeApplicationAccess}>
        <input type="hidden" name="id" value={id} />
        <input type="hidden" name="returnTo" value={returnTo} />
        <Button type="submit" size={size} variant="destructive">
          Revoke access
        </Button>
      </form>
    );
  }

  return null;
}
