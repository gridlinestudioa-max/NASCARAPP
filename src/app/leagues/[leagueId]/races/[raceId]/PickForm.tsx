"use client";

import { useActionState } from "react";
import { submitPick } from "./actions";

type Driver = { id: string; name: string };

export default function PickForm({
  leagueId,
  raceId,
  drivers,
  picksPerWeek,
  currentDriverIdBySlot,
}: {
  leagueId: string;
  raceId: string;
  drivers: Driver[];
  picksPerWeek: number;
  currentDriverIdBySlot: (string | null)[];
}) {
  const [error, formAction, pending] = useActionState(submitPick, undefined);
  const slots = Array.from({ length: picksPerWeek }, (_, i) => i + 1);
  const hasAnyPick = currentDriverIdBySlot.some((d) => d != null);

  return (
    <form action={formAction}>
      <input type="hidden" name="leagueId" value={leagueId} />
      <input type="hidden" name="raceId" value={raceId} />

      {slots.map((slot) => (
        <div key={slot}>
          <label htmlFor={`driverId-${slot}`}>{picksPerWeek > 1 ? `Pick ${slot}` : "Your pick"}</label>
          <br />
          <select
            id={`driverId-${slot}`}
            name={`driverId-${slot}`}
            required
            defaultValue={currentDriverIdBySlot[slot - 1] ?? ""}
          >
            <option value="" disabled>
              Select a driver
            </option>
            {drivers.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </div>
      ))}

      {error && <p role="alert">{error}</p>}

      <button type="submit" disabled={pending}>
        {pending ? "Saving..." : hasAnyPick ? "Change pick" : "Submit pick"}
      </button>
    </form>
  );
}
