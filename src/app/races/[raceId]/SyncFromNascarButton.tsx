"use client";

import { useState, useTransition } from "react";
import { syncRaceFromNascar } from "./actions";

export default function SyncFromNascarButton({ raceId, lastSyncedAt }: { raceId: string; lastSyncedAt: string | null }) {
  const [message, setMessage] = useState<string | undefined>();
  const [syncing, startSync] = useTransition();

  function handleSync() {
    setMessage(undefined);
    startSync(async () => {
      const result = await syncRaceFromNascar(raceId);
      setMessage(result);
    });
  }

  return (
    <p>
      <button type="button" onClick={handleSync} disabled={syncing}>
        {syncing ? "Syncing..." : "Sync from NASCAR"}
      </button>{" "}
      {lastSyncedAt && (
        <span>
          last synced {new Date(lastSyncedAt).toLocaleString(undefined, { dateStyle: "short", timeStyle: "short" })}
        </span>
      )}
      {message && <span role="status"> — {message}</span>}
    </p>
  );
}
