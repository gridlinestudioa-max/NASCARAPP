"use client";

import Link from "next/link";
import { useActionState, useId } from "react";
import RaceLogo from "@/components/ui/RaceLogo";
import Badge from "@/components/ui/Badge";
import { displayRaceName } from "@/lib/raceName";
import { RACE_LOGO_OPTIONS } from "@/lib/raceLogos";
import { addRace, deleteRace, duplicateSchedule, moveRace, updateRace } from "@/app/admin/season-setup/actions";

type RaceRow = {
  id: string;
  week: number;
  trackName: string;
  date: string; // yyyy-mm-dd
  fieldSize: number;
  isNonPoints: boolean;
  status: string;
  logoOverride: string | null;
};

export default function SeasonScheduleCard({
  seasonId,
  races,
  editable,
  previousSeasonId,
}: {
  seasonId: string;
  races: RaceRow[];
  editable: boolean;
  previousSeasonId?: string | null;
}) {
  if (!editable) {
    return (
      <ul className="rowList">
        {races.map((r) => (
          <li key={r.id}>
            <Link href={`/admin/races/${r.id}`}>
              <span className="driverCell">
                <RaceLogo trackName={r.trackName} size={28} overrideSrc={r.logoOverride} />
                Week {r.week} — {displayRaceName(r.trackName)}
              </span>
            </Link>
            <span>
              {r.isNonPoints && <Badge tone="warning">Non-points</Badge>}{" "}
              {r.status === "COMPLETE" && <Badge tone="success">Final</Badge>}{" "}
              <small className="muted">{new Date(r.date).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</small>
            </span>
          </li>
        ))}
      </ul>
    );
  }

  // `races` arrives sorted by week ascending (see season-setup/page.tsx),
  // so array position doubles as "first/last on the schedule" for the
  // move-up/move-down buttons below.
  return (
    <div>
      {previousSeasonId && races.length === 0 && (
        <DuplicateScheduleForm fromSeasonId={previousSeasonId} toSeasonId={seasonId} />
      )}
      <AddRaceForm seasonId={seasonId} />
      {races.length === 0 ? (
        <p className="muted">No races on the schedule yet.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th />
              <th>Week</th>
              <th>Track name</th>
              <th>Date</th>
              <th>Field size</th>
              <th>Non-points</th>
              <th>Logo</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {races.map((r, i) => (
              // Keyed on every field, not just id: the week/trackName/etc.
              // inputs below are uncontrolled (defaultValue), so a change
              // that comes from outside this row's own form — a reorder
              // swapping this row's week, a duplicate overwriting it —
              // wouldn't otherwise be reflected, leaving a stale value to
              // silently resubmit on the next Save.
              <RaceEditRow
                key={`${r.id}:${r.week}:${r.trackName}:${r.date}:${r.fieldSize}:${r.isNonPoints}:${r.logoOverride}`}
                race={r}
                isFirst={i === 0}
                isLast={i === races.length - 1}
              />
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function DuplicateScheduleForm({ fromSeasonId, toSeasonId }: { fromSeasonId: string; toSeasonId: string }) {
  const [message, formAction, pending] = useActionState(duplicateSchedule, undefined);
  return (
    <form action={formAction}>
      <input type="hidden" name="fromSeasonId" value={fromSeasonId} />
      <input type="hidden" name="toSeasonId" value={toSeasonId} />
      <button type="submit" disabled={pending}>
        {pending ? "Duplicating..." : "Duplicate the other season's schedule"}
      </button>
      {message && <p role="status">{message}</p>}
    </form>
  );
}

function AddRaceForm({ seasonId }: { seasonId: string }) {
  const [message, formAction, pending] = useActionState(addRace, undefined);
  return (
    <form action={formAction}>
      <input type="hidden" name="seasonId" value={seasonId} />
      <input type="number" name="week" placeholder="Week #" required style={{ width: "6em" }} />
      <input type="text" name="trackName" placeholder="Track / race name" required />
      <input type="date" name="date" required />
      <input type="number" name="fieldSize" placeholder="Field size" defaultValue={40} style={{ width: "8em" }} />
      <label>
        <input type="checkbox" name="isNonPoints" /> Non-points
      </label>
      <select name="logoOverride" defaultValue="">
        <option value="">Logo: auto-match</option>
        {RACE_LOGO_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <button type="submit" disabled={pending}>
        {pending ? "Adding..." : "Add race"}
      </button>
      {message && <p role="status">{message}</p>}
    </form>
  );
}

// Same form-outside-the-row trick as DriverRosterPanel's DriverRow — see
// its comment for why a <form> can't wrap the <td>s directly.
function RaceEditRow({ race, isFirst, isLast }: { race: RaceRow; isFirst: boolean; isLast: boolean }) {
  const [message, updateAction, updatePending] = useActionState(updateRace, undefined);
  const [deleteMessage, deleteFormAction, deletePending] = useActionState(deleteRace, undefined);
  const [moveMessage, moveFormAction, movePending] = useActionState(moveRace, undefined);
  const formId = useId();
  const deleteFormId = useId();
  const upFormId = useId();
  const downFormId = useId();

  return (
    <tr>
      <td>
        <form id={formId} action={updateAction} />
        <form id={deleteFormId} action={deleteFormAction} />
        <form id={upFormId} action={moveFormAction} />
        <form id={downFormId} action={moveFormAction} />
        <input type="hidden" form={formId} name="raceId" value={race.id} />
        <input type="hidden" form={deleteFormId} name="raceId" value={race.id} />
        <input type="hidden" form={upFormId} name="raceId" value={race.id} />
        <input type="hidden" form={upFormId} name="direction" value="up" />
        <input type="hidden" form={downFormId} name="raceId" value={race.id} />
        <input type="hidden" form={downFormId} name="direction" value="down" />
        <button form={upFormId} type="submit" disabled={movePending || isFirst} aria-label="Move up" title="Move up">
          ▲
        </button>
        <button
          form={downFormId}
          type="submit"
          disabled={movePending || isLast}
          aria-label="Move down"
          title="Move down"
        >
          ▼
        </button>
      </td>
      <td>
        <input type="number" form={formId} name="week" defaultValue={race.week} style={{ width: "4.5em" }} />
      </td>
      <td>
        <input type="text" form={formId} name="trackName" defaultValue={race.trackName} />
      </td>
      <td>
        <input type="date" form={formId} name="date" defaultValue={race.date} />
      </td>
      <td>
        <input type="number" form={formId} name="fieldSize" defaultValue={race.fieldSize} style={{ width: "6em" }} />
      </td>
      <td>
        <input type="checkbox" form={formId} name="isNonPoints" defaultChecked={race.isNonPoints} />
      </td>
      <td>
        <select form={formId} name="logoOverride" defaultValue={race.logoOverride ?? ""}>
          <option value="">Auto-match</option>
          {RACE_LOGO_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </td>
      <td>
        <button form={formId} type="submit" disabled={updatePending}>
          {updatePending ? "Saving..." : "Save"}
        </button>{" "}
        <button form={deleteFormId} type="submit" disabled={deletePending}>
          {deletePending ? "Removing..." : "Delete"}
        </button>
        {message && <small role="status"> {message}</small>}
        {deleteMessage && <small role="status"> {deleteMessage}</small>}
        {moveMessage && <small role="status"> {moveMessage}</small>}
      </td>
    </tr>
  );
}
