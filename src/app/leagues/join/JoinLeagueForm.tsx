"use client";

import { useActionState } from "react";
import { joinLeague } from "./actions";

export default function JoinLeagueForm() {
  const [error, formAction, pending] = useActionState(joinLeague, undefined);

  return (
    <form action={formAction}>
      <div>
        <label htmlFor="inviteCode">Invite code</label>
        <br />
        <input id="inviteCode" name="inviteCode" type="text" required autoFocus />
      </div>

      {error && <p role="alert">{error}</p>}

      <button type="submit" disabled={pending}>
        {pending ? "Joining..." : "Join league"}
      </button>
    </form>
  );
}
