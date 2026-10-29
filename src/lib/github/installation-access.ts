export function installationOwnerUpdate(input: {
  accountType: string;
  existingUserId: string | null;
  linkingUserId: string;
}): { userId: string | null; addMember: true } {
  const org = input.accountType.trim().toLowerCase() === "organization";
  if (org && input.existingUserId && input.existingUserId !== input.linkingUserId) {
    return { userId: null, addMember: true };
  }
  return { userId: input.linkingUserId, addMember: true };
}

export function installationVisibleWhere(userId: string) {
  return {
    uninstalledAt: null,
    suspendedAt: null,
    OR: [{ userId }, { members: { some: { userId } } }],
  };
}
