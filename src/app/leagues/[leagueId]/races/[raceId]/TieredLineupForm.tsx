"use client";

import { useActionState } from "react";
import { TIERED_LINEUP_SLOTS, type DriverTier } from "@/lib/tieredDraft";
import { submitTieredLineup } from "./actions";

type DriverOption = { id: string; name: string; startsUsed: number };

const TIER_LABEL: Record<DriverTier, string> = { A: "Tier A", B: "Tier B", C: "Tier C" };

export default function TieredLineupForm({
  leagueId,
  raceId,
  lockPhase,
  maxStartsPerDriverPerSeason,
  driversByTier,
  currentDriverIdByPickNumber,
  usingCarriedOverPreview,
}: {
  leagueId: string;
  raceId: string;
  lockPhase: "open" | "lateSwapOnly";
  maxStartsPerDriverPerSeason: number;
  driversByTier: Record<DriverTier, DriverOption[]>;
  currentDriverIdByPickNumber: (string | null)[];
  usingCarriedOverPreview: boolean;
}) {
  const [error, formAction, pending] = useActionState(submitTieredLineup, undefined);

  const starterSlots = TIERED_LINEUP_SLOTS.filter((s) => s.role === "STARTER");
  const benchSlots = TIERED_LINEUP_SLOTS.filter((s) => s.role === "BENCH");

  function renderSlotSelect(pickNumber: number, tier: DriverTier, role: "STARTER" | "BENCH") {
    const options = driversByTier[tier];
    return (
      <select
        key={pickNumber}
        id={`driverId-${pickNumber}`}
        name={`driverId-${pickNumber}`}
        required
        defaultValue={currentDriverIdByPickNumber[pickNumber - 1] ?? ""}
      >
        <option value="" disabled>
          Select a driver
        </option>
        {options.map((d) => (
          <option key={d.id} value={d.id}>
            {d.name}
            {role === "STARTER" ? ` (${d.startsUsed}/${maxStartsPerDriverPerSeason} starts used)` : ""}
          </option>
        ))}
      </select>
    );
  }

  return (
    <form action={formAction}>
      <input type="hidden" name="leagueId" value={leagueId} />
      <input type="hidden" name="raceId" value={raceId} />

      {usingCarriedOverPreview && (
        <p>
          <em>Showing last week&apos;s lineup — it&apos;ll carry over as-is unless you change and save it.</em>
        </p>
      )}
      {lockPhase === "lateSwapOnly" && (
        <p>
          <em>
            Lineups are locked for new drivers — you can still swap a starter for its own bench driver in the same
            tier, right up until 5 minutes before the race.
          </em>
        </p>
      )}

      <h3>Starters</h3>
      <table>
        <thead>
          <tr>
            <th>Tier</th>
            <th>Driver</th>
          </tr>
        </thead>
        <tbody>
          {starterSlots.map((slot) => (
            <tr key={slot.pickNumber}>
              <td>{TIER_LABEL[slot.tier]}</td>
              <td>{renderSlotSelect(slot.pickNumber, slot.tier, "STARTER")}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h3>Bench</h3>
      <table>
        <thead>
          <tr>
            <th>Tier</th>
            <th>Driver</th>
          </tr>
        </thead>
        <tbody>
          {benchSlots.map((slot) => (
            <tr key={slot.pickNumber}>
              <td>{TIER_LABEL[slot.tier]}</td>
              <td>{renderSlotSelect(slot.pickNumber, slot.tier, "BENCH")}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {error && <p role="alert">{error}</p>}

      <button type="submit" disabled={pending}>
        {pending ? "Saving..." : "Save lineup"}
      </button>
    </form>
  );
}
