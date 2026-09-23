"use client";

import { useActionState, useMemo, useState } from "react";
import { submitPick } from "./actions";
import styles from "./PickForm.module.css";

type Driver = { id: string; name: string };

export default function PickForm({
  leagueId,
  raceId,
  drivers,
  picksPerWeek,
  currentDriverIdBySlot,
}: {
  leagueId: string;
  raceId: string;
  drivers: Driver[];
  picksPerWeek: number;
  currentDriverIdBySlot: (string | null)[];
}) {
  const [error, formAction, pending] = useActionState(submitPick, undefined);
  const slots = Array.from({ length: picksPerWeek }, (_, i) => i + 1);
  const hasAnyPick = currentDriverIdBySlot.some((d) => d != null);

  return (
    <form action={formAction} className={styles.form}>
      <input type="hidden" name="leagueId" value={leagueId} />
      <input type="hidden" name="raceId" value={raceId} />

      {slots.map((slot) => (
        <DriverPicker
          key={slot}
          slot={slot}
          label={picksPerWeek > 1 ? `Pick ${slot}` : "Your driver"}
          drivers={drivers}
          defaultDriverId={currentDriverIdBySlot[slot - 1] ?? null}
        />
      ))}

      {error && <p role="alert">{error}</p>}

      <button type="submit" className={styles.submitBtn} disabled={pending}>
        {pending ? "Saving..." : hasAnyPick ? "Change pick" : "Submit pick"}
      </button>
    </form>
  );
}

// A searchable, click-to-select driver list in place of a bare <select> —
// the field grows to 30-40 drivers, and a native dropdown gives no sense
// of who's still available or which one is currently picked. Selection is
// tracked in React state and submitted via a hidden input (rather than a
// native radio group) so the currently-selected driver's value survives
// being filtered out of view while searching.
function DriverPicker({
  slot,
  label,
  drivers,
  defaultDriverId,
}: {
  slot: number;
  label: string;
  drivers: Driver[];
  defaultDriverId: string | null;
}) {
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(defaultDriverId);
  const name = `driverId-${slot}`;
  const selectedDriver = drivers.find((d) => d.id === selectedId) ?? null;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return drivers;
    return drivers.filter((d) => d.name.toLowerCase().includes(q));
  }, [drivers, query]);

  return (
    <div className={styles.field}>
      <div className={styles.fieldHead}>
        <span className={styles.fieldLabel}>{label}</span>
        {selectedDriver && <span className={styles.selectedName}>{selectedDriver.name}</span>}
      </div>
      <input type="hidden" name={name} value={selectedId ?? ""} />
      <input
        type="text"
        className={styles.search}
        placeholder="Search drivers…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        aria-label={`Search drivers for ${label}`}
      />
      <div className={styles.driverList} role="group" aria-label={label}>
        {filtered.length === 0 ? (
          <p className={styles.noResults}>No drivers match &quot;{query}&quot;.</p>
        ) : (
          filtered.map((d) => {
            const active = d.id === selectedId;
            return (
              <button
                key={d.id}
                type="button"
                aria-pressed={active}
                className={active ? `${styles.driverRow} ${styles.driverRowActive}` : styles.driverRow}
                onClick={() => setSelectedId(d.id)}
              >
                {d.name}
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
