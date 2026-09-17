"use client";

import { useActionState } from "react";
import { submitTiers } from "./actions";

type DriverRow = { driverId: string; name: string; tier: "A" | "B" | "C" | null };

export default function TiersForm({ raceId, drivers }: { raceId: string; drivers: DriverRow[] }) {
  const [error, formAction, pending] = useActionState(submitTiers, undefined);

  return (
    <form action={formAction}>
      <input type="hidden" name="raceId" value={raceId} />

      <table>
        <thead>
          <tr>
            <th>Driver</th>
            <th>Tier</th>
          </tr>
        </thead>
        <tbody>
          {drivers.map((d) => (
            <tr key={d.driverId}>
              <td>{d.name}</td>
              <td>
                <select name={`tier-${d.driverId}`} defaultValue={d.tier ?? ""}>
                  <option value="">&mdash;</option>
                  <option value="A">A</option>
                  <option value="B">B</option>
                  <option value="C">C</option>
                </select>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {error && <p role="alert">{error}</p>}

      <button type="submit" disabled={pending}>
        {pending ? "Saving..." : "Save tiers"}
      </button>
    </form>
  );
}
