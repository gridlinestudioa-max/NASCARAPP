"use client";

import { useActionState } from "react";
import { submitResults } from "./actions";

type DriverRow = {
  driverId: string;
  name: string;
  finishPosition: number | null;
  stage1Position: number | null;
  stage2Position: number | null;
};

export default function ResultsForm({ raceId, drivers }: { raceId: string; drivers: DriverRow[] }) {
  const [error, formAction, pending] = useActionState(submitResults, undefined);

  return (
    <form action={formAction}>
      <input type="hidden" name="raceId" value={raceId} />

      <table>
        <thead>
          <tr>
            <th>Driver</th>
            <th>Finishing position</th>
            <th>Stage 1 (top 10, blank if not)</th>
            <th>Stage 2 (top 10, blank if not)</th>
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
              <td>
                <input
                  type="number"
                  name={`stage1-${d.driverId}`}
                  min={1}
                  max={10}
                  defaultValue={d.stage1Position ?? undefined}
                />
              </td>
              <td>
                <input
                  type="number"
                  name={`stage2-${d.driverId}`}
                  min={1}
                  max={10}
                  defaultValue={d.stage2Position ?? undefined}
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
