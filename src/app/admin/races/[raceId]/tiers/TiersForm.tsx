"use client";

import { useActionState, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { autoAssignTiers, submitTiers } from "./actions";

type DriverRow = { driverId: string; name: string; tier: "A" | "B" | "C" | null };

export default function TiersForm({ raceId, drivers }: { raceId: string; drivers: DriverRow[] }) {
  const [error, formAction, pending] = useActionState(submitTiers, undefined);
  const router = useRouter();
  const [autoMessage, setAutoMessage] = useState<string | undefined>();
  const [autoAssigning, startAutoAssign] = useTransition();
  // The <select>s below use defaultValue (uncontrolled) so typing in one
  // doesn't fight the others; router.refresh() alone won't re-apply a new
  // defaultValue to an already-mounted element, so remount the whole form
  // (via this key) once fresh computed tiers have actually landed.
  const [formKey, setFormKey] = useState(0);

  function handleAutoAssign() {
    setAutoMessage(undefined);
    startAutoAssign(async () => {
      const result = await autoAssignTiers(raceId);
      setAutoMessage(result);
      router.refresh();
      setFormKey((k) => k + 1);
    });
  }

  return (
    <>
      <p>
        <button type="button" onClick={handleAutoAssign} disabled={autoAssigning}>
          {autoAssigning ? "Computing..." : "Auto-assign tiers"}
        </button>{" "}
        <small>weighted 65% season points / 25% recent form / 10% track history — review before saving</small>
      </p>
      {autoMessage && <p role="status">{autoMessage}</p>}

      <form key={formKey} action={formAction}>
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
    </>
  );
}
