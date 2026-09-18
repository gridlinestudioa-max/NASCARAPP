"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// Silently re-fetches the current page's server-rendered data on an
// interval, so standings/scores/charts catch up after a commissioner
// syncs new results without anyone needing to hit refresh. Skips the
// tick while the tab isn't visible, so a backgrounded tab doesn't keep
// hitting the database for no one.
export default function LiveRefresh({ intervalMs = 30000 }: { intervalMs?: number }) {
  const router = useRouter();

  useEffect(() => {
    const id = setInterval(() => {
      if (document.visibilityState === "visible") {
        router.refresh();
      }
    }, intervalMs);
    return () => clearInterval(id);
  }, [router, intervalMs]);

  return null;
}
