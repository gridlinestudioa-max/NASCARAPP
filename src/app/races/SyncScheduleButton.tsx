"use client";

import { useState, useTransition } from "react";
import { syncSeasonScheduleFromNascar } from "./actions";

export default function SyncScheduleButton({ seasonId }: { seasonId: string }) {
  const [message, setMessage] = useState<string | undefined>();
  const [syncing, startSync] = useTransition();

  function handleSync() {
    setMessage(undefined);
    startSync(async () => {
      const result = await syncSeasonScheduleFromNascar(seasonId);
      setMessage(result);
    });
  }

  return (
    <p>
      <button type="button" onClick={handleSync} disabled={syncing}>
        {syncing ? "Syncing..." : "Sync schedule from NASCAR"}
      </button>{" "}
      <small>Matches every race this season to NASCAR&apos;s real track names, so per-race syncs below work reliably.</small>
      {message && <span role="status"> — {message}</span>}
    </p>
  );
}
