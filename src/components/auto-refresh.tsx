"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/**
 * Re-renders the server component tree on an interval. Used while a job is in
 * flight so progress advances without the user reloading; it stops as soon as
 * nothing is active, so an idle queue costs nothing.
 */
export function AutoRefresh({
  enabled,
  intervalMs = 2000,
}: {
  enabled: boolean;
  intervalMs?: number;
}) {
  const router = useRouter();

  useEffect(() => {
    if (!enabled) return;
    const timer = setInterval(() => router.refresh(), intervalMs);
    return () => clearInterval(timer);
  }, [enabled, intervalMs, router]);

  return null;
}
