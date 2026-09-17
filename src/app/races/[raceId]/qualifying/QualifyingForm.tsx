"use client";

import { useActionState } from "react";
import { submitQualifying } from "./actions";

type DriverRow = { driverId: string; name: string; tier: "A" | "B" | "C"; qualifyingPosition: number | null };

export default function QualifyingForm({ raceId, drivers }: { raceId: string; drivers: DriverRow[] }) {
  const [error, formAction, pending] = useActionState(submitQualifying, undefined);

  return (
    <form action={formAction}>
      <input type="hidden" name="raceId" value={raceId} />

      <table>
        <thead>
          <tr>
            <th>Driver</th>
            <th>Tier</th>
            <th>Qualifying position</th>
          </tr>
        </thead>
        <tbody>
          {drivers.map((d) => (
            <tr key={d.driverId}>
              <td>{d.name}</td>
              <td>{d.tier}</td>
              <td>
                <input
                  type="number"
                  name={`position-${d.driverId}`}
                  min={1}
                  defaultValue={d.qualifyingPosition ?? undefined}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {error && <p role="alert">{error}</p>}

      <button type="submit" disabled={pending}>
        {pending ? "Saving..." : "Save qualifying results"}
      </button>
    </form>
  );
}
