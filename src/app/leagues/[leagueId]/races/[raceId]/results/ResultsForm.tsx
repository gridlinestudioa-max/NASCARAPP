"use client";

import { useActionState } from "react";
import { submitResults } from "./actions";

type DriverRow = { driverId: string; name: string; finishPosition: number | null };

export default function ResultsForm({
  leagueId,
  raceId,
  drivers,
}: {
  leagueId: string;
  raceId: string;
  drivers: DriverRow[];
}) {
  const [error, formAction, pending] = useActionState(submitResults, undefined);

  return (
    <form action={formAction}>
      <input type="hidden" name="leagueId" value={leagueId} />
      <input type="hidden" name="raceId" value={raceId} />

      <table>
        <thead>
          <tr>
            <th>Driver</th>
            <th>Finishing position</th>
          </tr>
        </thead>
        <tbody>
          {drivers.map((d) => (
            <tr key={d.driverId}>
              <td>
                {d.name}
                <input type="hidden" name="driverId" value={d.driverId} />
              </td>
              <td>
                <input
                  type="number"
                  name={`finish-${d.driverId}`}
                  min={1}
                  required
                  defaultValue={d.finishPosition ?? undefined}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {error && <p role="alert">{error}</p>}

      <button type="submit" disabled={pending}>
        {pending ? "Saving..." : "Save results"}
      </button>
    </form>
  );
}
