export function betaAccessAfterEmailChange(): {
  revokePreviousEmail: boolean;
  grantNextEmail: boolean;
} {
  return { revokePreviousEmail: false, grantNextEmail: false };
}

export function betaAccessEmailsToRevokeOnDelete(email: string | null): string[] {
  return email ? [email] : [];
}
