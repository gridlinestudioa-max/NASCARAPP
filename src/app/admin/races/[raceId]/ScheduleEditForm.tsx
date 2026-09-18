"use client";

import { useActionState } from "react";
import { updateRaceSchedule } from "./actions";

export default function ScheduleEditForm({
  raceId,
  trackName,
  date,
}: {
  raceId: string;
  trackName: string;
  date: string;
}) {
  const [message, formAction, pending] = useActionState(updateRaceSchedule, undefined);

  return (
    <form action={formAction}>
      <input type="hidden" name="raceId" value={raceId} />
      <label>
        Track name
        <input type="text" name="trackName" defaultValue={trackName} required />
      </label>
      <label>
        Date
        <input type="date" name="date" defaultValue={date} required />
      </label>
      {message && <p role="status">{message}</p>}
      <button type="submit" disabled={pending}>
        {pending ? "Saving..." : "Save schedule"}
      </button>
    </form>
  );
}
