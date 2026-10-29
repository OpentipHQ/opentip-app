export const authErrors: Record<string, string> = {
  state: "The sign-in attempt expired. Try again.",
  github: "GitHub did not complete sign-in. Check the app client id and secret.",
  database: "The database is not connected, so the account could not be saved.",
  session: "SESSION_SECRET is missing.",
  installation: "That GitHub installation is not available for this account.",
  email: "GitHub did not share a verified email.",
  conflict: "That email is already linked to a different GitHub account.",
  suspended: "This account is suspended.",
  expired: "That code expired. Send a new one.",
  wrong: "That code is wrong.",
  too_many: "Too many attempts. Send a new code.",
  missing: "Request a new code.",
  used: "That code was already used. Send a new one.",
  cooldown: "Wait a minute before sending another code.",
  rate: "Too many codes were sent. Try again later.",
  unconfigured: "Sign-in email is not configured yet.",
  invalid: "Enter a valid email address.",
  disabled: "Email sign-in is disabled.",
};

export const installNotice = "Sign in to finish linking the GitHub App.";
