"use client";

import { useActionState, useId } from "react";
import { addDriver, duplicateRoster, updateDriverForSeason } from "@/app/admin/season-setup/actions";
import DriverNumberBadge from "@/components/ui/DriverNumberBadge";

type DriverRow = { id: string; name: string; number: number | null; team: string | null; isActive: boolean };

// isActive here is already season-scoped (see getAllDriversForSeasonAdmin
// in lib/season.ts): a SeasonDriver override for `seasonId` if one
// exists, else the driver's own site-wide default. The "This Year" tab
// shows it read-only; "Next Year" is where a commissioner edits it —
// "Duplicate {prevYear}'s roster" snapshots this year's roster as
// explicit, independent rows for next year, and every edit after that
// (including adding a new driver) only ever touches next year's rows.
export default function DriverRosterPanel({
  drivers,
  editable,
  seasonId,
  previousSeasonId,
}: {
  drivers: DriverRow[];
  editable: boolean;
  seasonId: string;
  previousSeasonId?: string | null;
}) {
  if (!editable) {
    const active = drivers.filter((d) => d.isActive).sort((a, b) => a.name.localeCompare(b.name));
    return (
      <div>
        <p className="muted">{active.length} active drivers.</p>
        <ul className="rowList">
          {active.map((d) => (
            <li key={d.id}>
              <span className="driverCell">
                <DriverNumberBadge number={d.number} name={d.name} className="driverBadge" />
                {d.name}
              </span>
              <span className="muted">{d.team ?? "—"}</span>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  const sorted = [...drivers].sort((a, b) => Number(b.isActive) - Number(a.isActive) || a.name.localeCompare(b.name));

  return (
    <div>
      <p>
        <small>
          Number/team edits apply site-wide right away. The active checkbox only affects this season — see
          &ldquo;Duplicate&rdquo; below to start from a copy of the other season&apos;s roster.
        </small>
      </p>
      {previousSeasonId && <DuplicateRosterForm fromSeasonId={previousSeasonId} toSeasonId={seasonId} />}
      <AddDriverForm seasonId={seasonId} pinOutOfSeasonId={previousSeasonId ?? undefined} />
      <table>
        <thead>
          <tr>
            <th>Driver</th>
            <th>Number</th>
            <th>Team</th>
            <th>Active</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {sorted.map((d) => (
            // Keyed on every field, not just id — see SeasonScheduleCard's
            // RaceEditRow for why: a change from outside this row's own
            // form (duplicateRoster overwriting isActive, say) needs to
            // reset these uncontrolled inputs, not leave them stale.
            <DriverRow key={`${d.id}:${d.number}:${d.team}:${d.isActive}`} driver={d} seasonId={seasonId} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function DuplicateRosterForm({ fromSeasonId, toSeasonId }: { fromSeasonId: string; toSeasonId: string }) {
  const [message, formAction, pending] = useActionState(duplicateRoster, undefined);
  return (
    <form action={formAction}>
      <input type="hidden" name="fromSeasonId" value={fromSeasonId} />
      <input type="hidden" name="toSeasonId" value={toSeasonId} />
      <button type="submit" disabled={pending}>
        {pending ? "Duplicating..." : "Duplicate the other season's roster"}
      </button>
      {message && <p role="status">{message}</p>}
    </form>
  );
}

function AddDriverForm({ seasonId, pinOutOfSeasonId }: { seasonId: string; pinOutOfSeasonId?: string }) {
  const [message, formAction, pending] = useActionState(addDriver, undefined);
  return (
    <form action={formAction}>
      <input type="hidden" name="seasonId" value={seasonId} />
      {pinOutOfSeasonId && <input type="hidden" name="pinOutOfSeasonId" value={pinOutOfSeasonId} />}
      <input type="text" name="name" placeholder="Driver name" required />
      <input type="number" name="number" placeholder="Car #" />
      <input type="text" name="team" placeholder="Team" />
      <button type="submit" disabled={pending}>
        {pending ? "Adding..." : "Add driver"}
      </button>
      {message && <p role="status">{message}</p>}
    </form>
  );
}

// A <form> can't wrap <td>s as a direct child of <tr> — the HTML parser
// would hoist it out and break the table. Instead the (empty, childless)
// form lives inside the first cell, and every input/button in the row
// associates to it by id via the `form` attribute, which works anywhere
// in the document.
function DriverRow({ driver, seasonId }: { driver: DriverRow; seasonId: string }) {
  const [message, formAction, pending] = useActionState(updateDriverForSeason, undefined);
  const formId = useId();
  return (
    <tr>
      <td>
        <form id={formId} action={formAction} />
        <input type="hidden" form={formId} name="driverId" value={driver.id} />
        <input type="hidden" form={formId} name="seasonId" value={seasonId} />
        {driver.name}
      </td>
      <td>
        <input type="number" form={formId} name="number" defaultValue={driver.number ?? ""} />
      </td>
      <td>
        <input type="text" form={formId} name="team" defaultValue={driver.team ?? ""} />
      </td>
      <td>
        <input type="checkbox" form={formId} name="isActive" defaultChecked={driver.isActive} />
      </td>
      <td>
        <button form={formId} type="submit" disabled={pending}>
          {pending ? "Saving..." : "Save"}
        </button>
        {message && <small role="status"> {message}</small>}
      </td>
    </tr>
  );
}
