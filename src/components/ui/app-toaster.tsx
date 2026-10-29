"use client";

import { useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { Toaster, toast } from "sonner";
import { useTheme } from "@/components/theme/theme-provider";
import { decodeToast, TOAST_COOKIE } from "@/lib/toast";

function readToastCookie(): string | null {
  const prefix = `${TOAST_COOKIE}=`;
  const entry = document.cookie
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(prefix));
  return entry ? entry.slice(prefix.length) : null;
}

function clearToastCookie(): void {
  document.cookie = `${TOAST_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax`;
}

export function AppToaster() {
  const { resolvedTheme } = useTheme();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const search = searchParams.toString();

  useEffect(() => {
    const value = readToastCookie();
    if (!value) return;
    clearToastCookie();
    const payload = decodeToast(value);
    if (!payload) return;
    if (payload.tone === "success") toast.success(payload.message);
    else if (payload.tone === "error") toast.error(payload.message);
    else toast.info(payload.message);
  }, [pathname, search]);

  return (
    <Toaster theme={resolvedTheme} position="bottom-right" richColors closeButton />
  );
}
