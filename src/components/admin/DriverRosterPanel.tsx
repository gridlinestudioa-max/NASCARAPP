"use client";

import { useActionState, useId } from "react";
import { addDriver, updateDriver } from "@/app/admin/season-setup/actions";
import DriverNumberBadge from "@/components/ui/DriverNumberBadge";

type DriverRow = { id: string; name: string; number: number | null; team: string | null; isActive: boolean };

// The driver roster is one site-wide list (Driver.isActive), not a
// separate copy per season — there's no per-year snapshot of who's
// racing. The "This Year" tab shows it read-only (just the active
// drivers, as a reference); the "Next Year" tab is where a commissioner
// actually edits it — add a rookie, retire someone — ahead of the
// rollover. Editing here does take effect immediately site-wide (there's
// no scoping mechanism to delay it), which only matters if you flip a
// driver still racing this season.
export default function DriverRosterPanel({ drivers, editable }: { drivers: DriverRow[]; editable: boolean }) {
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
        <small>Changes here apply site-wide right away — including to the current season&apos;s pick lists.</small>
      </p>
      <AddDriverForm />
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
            <DriverRow key={d.id} driver={d} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function AddDriverForm() {
  const [message, formAction, pending] = useActionState(addDriver, undefined);
  return (
    <form action={formAction}>
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
function DriverRow({ driver }: { driver: DriverRow }) {
  const [message, formAction, pending] = useActionState(updateDriver, undefined);
  const formId = useId();
  return (
    <tr>
      <td>
        <form id={formId} action={formAction} />
        <input type="hidden" form={formId} name="driverId" value={driver.id} />
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
