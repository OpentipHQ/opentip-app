export function emailSignInAllowed(user: { emailSignInEnabled: boolean } | null): boolean {
  if (!user) return true;
  return user.emailSignInEnabled;
}
