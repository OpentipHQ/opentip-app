"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export function LiveRefresh({
  active,
  seconds = 2,
}: {
  active: boolean;
  seconds?: number;
}) {
  const router = useRouter();
  useEffect(() => {
    if (!active) return;
    const timer = setInterval(() => router.refresh(), seconds * 1_000);
    return () => clearInterval(timer);
  }, [active, router, seconds]);
  return null;
}
