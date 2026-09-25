"use client";

import { useActionState, useState } from "react";
import { updateInviteCode } from "./actions";

export default function InviteCodeForm({ leagueId, inviteCode }: { leagueId: string; inviteCode: string }) {
  const [error, formAction, pending] = useActionState(updateInviteCode, undefined);
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(inviteCode);

  if (!editing) {
    return (
      <p>
        Invite code: <code>{inviteCode}</code> — share it so others can join this league.{" "}
        <button type="button" onClick={() => setEditing(true)}>
          Change code
        </button>
      </p>
    );
  }

  return (
    <form action={formAction}>
      <input type="hidden" name="leagueId" value={leagueId} />
      <label htmlFor="inviteCode">Invite code:</label>{" "}
      <input
        id="inviteCode"
        name="inviteCode"
        value={value}
        onChange={(e) => setValue(e.target.value.toUpperCase())}
        minLength={4}
        maxLength={10}
        required
      />{" "}
      <button type="submit" disabled={pending}>
        {pending ? "Saving..." : "Save"}
      </button>{" "}
      <button type="button" onClick={() => setEditing(false)}>
        Cancel
      </button>
      <p>
        <small>4-10 letters/numbers. Anyone using the old code won&apos;t be able to join anymore.</small>
      </p>
      {error && <p role="alert">{error}</p>}
    </form>
  );
}
