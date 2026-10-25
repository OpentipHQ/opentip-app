import {
  EmailButton,
  EmailLayout,
  EmailMuted,
  EmailParagraph,
} from "@/lib/email/templates/layout";

export function BetaInviteEmail({
  inviteUrl,
  appUrl,
}: {
  inviteUrl: string;
  appUrl: string;
}) {
  return (
    <EmailLayout
      preview="Your Opentip beta access is ready."
      heading="You're invited to the Opentip beta"
      appUrl={appUrl}
      reason="You received this because you were invited to the Opentip beta."
    >
      <EmailParagraph>
        You have access to the Opentip beta. Opentip Copilot reads your GitHub repo, writes
        your docs, and updates them on every push.
      </EmailParagraph>
      <EmailButton href={inviteUrl} label="Join the beta" />
      <EmailMuted>
        Use the email address this invite was sent to. There is no charge during the beta.
      </EmailMuted>
    </EmailLayout>
  );
}

export function BetaApprovalEmail({
  loginUrl,
  appUrl,
}: {
  loginUrl: string;
  appUrl: string;
}) {
  return (
    <EmailLayout
      preview="Your Opentip beta application was approved."
      heading="You're in."
      appUrl={appUrl}
      reason="You received this because your Opentip beta application was approved."
    >
      <EmailParagraph>
        Your application for the Opentip beta was approved. Sign in with GitHub or a
        six-digit email code, then connect the repository you want documented.
      </EmailParagraph>
      <EmailButton href={loginUrl} label="Open Opentip" />
      <EmailParagraph>
        Opentip reads the code before it writes a word. It never commits to your repo and
        never opens a pull request.
      </EmailParagraph>
      <EmailMuted>There is no charge during the beta.</EmailMuted>
    </EmailLayout>
  );
}
