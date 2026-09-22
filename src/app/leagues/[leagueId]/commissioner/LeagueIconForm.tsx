"use client";

import { useActionState } from "react";
import { updateLeagueIcon } from "./actions";

export default function LeagueIconForm({ leagueId, iconUrl }: { leagueId: string; iconUrl: string | null }) {
  const [error, formAction, pending] = useActionState(updateLeagueIcon, undefined);

  return (
    <form action={formAction}>
      <input type="hidden" name="leagueId" value={leagueId} />
      <label htmlFor="iconUrl">Icon image URL</label>
      <br />
      <input id="iconUrl" name="iconUrl" type="text" placeholder="https://…" defaultValue={iconUrl ?? ""} />{" "}
      <button type="submit" disabled={pending}>
        {pending ? "Saving..." : "Save"}
      </button>
      {error && <p role="alert">{error}</p>}
      <p>
        <small>Shown in place of your league&apos;s initial-letter avatar. Leave blank to use that instead.</small>
      </p>
    </form>
  );
}
