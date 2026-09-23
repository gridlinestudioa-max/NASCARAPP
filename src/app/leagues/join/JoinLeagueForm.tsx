"use client";

import { useActionState, useState } from "react";
import { joinLeague } from "./actions";
import { LEAGUE_COLOR_SWATCHES } from "@/lib/leagueColors";
import styles from "./JoinLeagueForm.module.css";

export default function JoinLeagueForm() {
  const [error, formAction, pending] = useActionState(joinLeague, undefined);
  const [color, setColor] = useState<string>(LEAGUE_COLOR_SWATCHES[0]);

  return (
    <form action={formAction}>
      <div>
        <label htmlFor="inviteCode">Invite code</label>
        <br />
        <input
          id="inviteCode"
          name="inviteCode"
          type="text"
          required
          autoFocus
          maxLength={6}
          autoCapitalize="characters"
          autoComplete="off"
          style={{ textTransform: "uppercase" }}
        />
      </div>

      <div>
        <label>Sidebar color</label>
        <br />
        <input type="hidden" name="color" value={color} />
        <div className={styles.swatchRow}>
          {LEAGUE_COLOR_SWATCHES.map((swatch) => (
            <button
              key={swatch}
              type="button"
              aria-label={`Use ${swatch} as this league's sidebar color`}
              aria-pressed={swatch === color}
              onClick={() => setColor(swatch)}
              className={swatch === color ? `${styles.swatch} ${styles.swatchActive}` : styles.swatch}
              style={{ background: swatch }}
            />
          ))}
        </div>
      </div>

      {error && <p role="alert">{error}</p>}

      <button type="submit" disabled={pending}>
        {pending ? "Joining..." : "Join league"}
      </button>
    </form>
  );
}
