import { notFound, redirect } from "next/navigation";
import { getRequestSession } from "@/lib/auth";
import { readActAs } from "@/lib/admin/act-as";
import type { Session } from "@/lib/session";

export async function requireAdminPage(): Promise<Session> {
  const session = await getRequestSession();
  if (!session) redirect("/login?next=/admin");
  if (session.role !== "ADMIN") notFound();
  return session;
}

export async function requireAdminAction(): Promise<Session> {
  const session = await getRequestSession();
  if (!session || session.role !== "ADMIN") notFound();
  return session;
}

export async function requireWritableAdminAction(): Promise<Session> {
  const session = await requireAdminAction();
  const actAs = await readActAs();
  if (actAs) notFound();
  return session;
}

export async function requireUserAction(): Promise<Session> {
  const session = await getRequestSession();
  if (!session) redirect("/login");
  const actAs = await readActAs();
  if (actAs) notFound();
  return session;
}

export async function blockActAsWrites(): Promise<void> {
  const actAs = await readActAs();
  if (actAs) notFound();
}
