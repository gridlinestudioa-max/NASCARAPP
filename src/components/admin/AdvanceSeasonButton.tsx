"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { advanceToNextSeason } from "@/app/admin/season-setup/actions";

export default function AdvanceSeasonButton({
  currentYear,
  nextYear,
  nextYearRaceCount,
  continuingLeagueCount,
}: {
  currentYear: number;
  nextYear: number;
  nextYearRaceCount: number;
  continuingLeagueCount: number;
}) {
  const [confirming, setConfirming] = useState(false);
  const [message, setMessage] = useState<string | undefined>();
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const disabled = nextYearRaceCount === 0;

  function handleAdvance() {
    startTransition(async () => {
      const result = await advanceToNextSeason();
      setMessage(result.ok ? result.message : result.error);
      setConfirming(false);
      router.refresh();
    });
  }

  return (
    <div>
      {disabled && <p className="muted">Add at least one race to the {nextYear} schedule before you can advance.</p>}
      {!confirming ? (
        <button type="button" onClick={() => setConfirming(true)} disabled={disabled || pending}>
          Move site to {nextYear} season
        </button>
      ) : (
        <p role="alert">
          This makes {nextYear} the current season everywhere on the site ({nextYearRaceCount} race
          {nextYearRaceCount === 1 ? "" : "s"} scheduled) and carries {continuingLeagueCount} league
          {continuingLeagueCount === 1 ? "" : "s"} forward with fresh, independently-editable rules — all {currentYear}{" "}
          history stays exactly as-is. This can&apos;t be easily undone.{" "}
          <button type="button" onClick={handleAdvance} disabled={pending}>
            {pending ? "Advancing..." : "Yes, advance to " + nextYear}
          </button>{" "}
          <button type="button" onClick={() => setConfirming(false)} disabled={pending}>
            Cancel
          </button>
        </p>
      )}
      {message && <p role="status">{message}</p>}
    </div>
  );
}
