"use client";

import { useActionState } from "react";
import { submitPick } from "./actions";

type Driver = { id: string; name: string };

export default function PickForm({
  leagueId,
  raceId,
  drivers,
  currentDriverId,
}: {
  leagueId: string;
  raceId: string;
  drivers: Driver[];
  currentDriverId: string | null;
}) {
  const [error, formAction, pending] = useActionState(submitPick, undefined);

  return (
    <form action={formAction}>
      <input type="hidden" name="leagueId" value={leagueId} />
      <input type="hidden" name="raceId" value={raceId} />

      <label htmlFor="driverId">Your pick</label>
      <br />
      <select id="driverId" name="driverId" required defaultValue={currentDriverId ?? ""}>
        <option value="" disabled>
          Select a driver
        </option>
        {drivers.map((d) => (
          <option key={d.id} value={d.id}>
            {d.name}
          </option>
        ))}
      </select>

      {error && <p role="alert">{error}</p>}

      <button type="submit" disabled={pending}>
        {pending ? "Saving..." : currentDriverId ? "Change pick" : "Submit pick"}
      </button>
    </form>
  );
}
