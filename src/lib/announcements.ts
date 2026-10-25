import { getPrisma } from "@/lib/db";

export async function loadActiveAnnouncement(): Promise<{
  title: string;
  body: string;
} | null> {
  const prisma = getPrisma();
  if (!prisma) return null;
  const row = await prisma.announcement.findFirst({
    where: { active: true },
    orderBy: { createdAt: "desc" },
    select: { title: true, body: true },
  });
  return row;
}
