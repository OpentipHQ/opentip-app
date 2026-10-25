export function canUnlinkGithub(user: { githubId: string | null; email: string | null; emailSignInEnabled: boolean }): boolean {
  if (!user.githubId) return false;
  return Boolean(user.email && user.emailSignInEnabled);
}

export function canUnlinkEmail(user: { githubId: string | null; email: string | null; emailSignInEnabled: boolean }): boolean {
  return Boolean(user.email && user.emailSignInEnabled && user.githubId);
}

export function deleteConfirmationMatches(input: string, login: string): boolean {
  return input.trim().toLowerCase() === login.trim().toLowerCase() && login.trim().length > 0;
}
