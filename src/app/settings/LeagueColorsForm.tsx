"use client";

import { useActionState, useState } from "react";
import { updateLeagueColor, type FormState } from "./actions";
import { LEAGUE_COLOR_SWATCHES } from "@/lib/leagueColors";
import styles from "./LeagueColorsForm.module.css";

function LeagueColorRow({ leagueId, leagueName, initialColor }: { leagueId: string; leagueName: string; initialColor: string | null }) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(updateLeagueColor, undefined);
  const [color, setColor] = useState<string>(initialColor ?? LEAGUE_COLOR_SWATCHES[0]);

  return (
    <form action={formAction} className={styles.row}>
      <input type="hidden" name="leagueId" value={leagueId} />
      <input type="hidden" name="color" value={color} />
      <span className={styles.leagueName}>{leagueName}</span>
      <span className={styles.swatchRow}>
        {LEAGUE_COLOR_SWATCHES.map((swatch) => (
          <button
            key={swatch}
            type="button"
            aria-label={`Use ${swatch} for ${leagueName}`}
            aria-pressed={swatch === color}
            onClick={() => setColor(swatch)}
            className={swatch === color ? `${styles.swatch} ${styles.swatchActive}` : styles.swatch}
            style={{ background: swatch }}
          />
        ))}
      </span>
      <button type="submit" className="linkButtonOutline" disabled={pending || color === initialColor}>
        {pending ? "Saving..." : "Save"}
      </button>
      {state?.kind === "error" && <span role="alert" className={styles.error}>{state.message}</span>}
    </form>
  );
}

export default function LeagueColorsForm({
  memberships,
}: {
  memberships: { leagueId: string; leagueName: string; color: string | null }[];
}) {
  if (memberships.length === 0) {
    return <p>You&apos;re not in any leagues yet.</p>;
  }

  return (
    <div className={styles.list}>
      {memberships.map((m) => (
        <LeagueColorRow key={m.leagueId} leagueId={m.leagueId} leagueName={m.leagueName} initialColor={m.color} />
      ))}
    </div>
  );
}
