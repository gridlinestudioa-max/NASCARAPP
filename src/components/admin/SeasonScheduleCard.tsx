"use client";

import Link from "next/link";
import { useActionState, useId } from "react";
import RaceLogo from "@/components/ui/RaceLogo";
import Badge from "@/components/ui/Badge";
import { displayRaceName } from "@/lib/raceName";
import { addRace, deleteRace, updateRace } from "@/app/admin/season-setup/actions";

type RaceRow = {
  id: string;
  week: number;
  trackName: string;
  date: string; // yyyy-mm-dd
  fieldSize: number;
  isNonPoints: boolean;
  status: string;
};

export default function SeasonScheduleCard({
  seasonId,
  races,
  editable,
}: {
  seasonId: string;
  races: RaceRow[];
  editable: boolean;
}) {
  if (!editable) {
    return (
      <ul className="rowList">
        {races.map((r) => (
          <li key={r.id}>
            <Link href={`/admin/races/${r.id}`}>
              <span className="driverCell">
                <RaceLogo trackName={r.trackName} size={28} />
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

  return (
    <div>
      <AddRaceForm seasonId={seasonId} />
      {races.length === 0 ? (
        <p className="muted">No races on the schedule yet.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Week</th>
              <th>Track name</th>
              <th>Date</th>
              <th>Field size</th>
              <th>Non-points</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {races.map((r) => (
              <RaceEditRow key={r.id} race={r} />
            ))}
          </tbody>
        </table>
      )}
    </div>
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
      <button type="submit" disabled={pending}>
        {pending ? "Adding..." : "Add race"}
      </button>
      {message && <p role="status">{message}</p>}
    </form>
  );
}

// Same form-outside-the-row trick as DriverRosterPanel's DriverRow — see
// its comment for why a <form> can't wrap the <td>s directly.
function RaceEditRow({ race }: { race: RaceRow }) {
  const [message, updateAction, updatePending] = useActionState(updateRace, undefined);
  const [deleteMessage, deleteFormAction, deletePending] = useActionState(deleteRace, undefined);
  const formId = useId();
  const deleteFormId = useId();

  return (
    <tr>
      <td>
        <form id={formId} action={updateAction} />
        <form id={deleteFormId} action={deleteFormAction} />
        <input type="hidden" form={formId} name="raceId" value={race.id} />
        <input type="hidden" form={deleteFormId} name="raceId" value={race.id} />
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
        <button form={formId} type="submit" disabled={updatePending}>
          {updatePending ? "Saving..." : "Save"}
        </button>{" "}
        <button form={deleteFormId} type="submit" disabled={deletePending}>
          {deletePending ? "Removing..." : "Delete"}
        </button>
        {message && <small role="status"> {message}</small>}
        {deleteMessage && <small role="status"> {deleteMessage}</small>}
      </td>
    </tr>
  );
}
