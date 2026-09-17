"use client";

import { useActionState } from "react";
import { createLeague } from "./actions";

export default function CreateLeagueForm() {
  const [error, formAction, pending] = useActionState(createLeague, undefined);

  return (
    <form action={formAction}>
      <div>
        <label htmlFor="name">League name</label>
        <br />
        <input id="name" name="name" type="text" required minLength={3} autoFocus />
      </div>

      {error && <p role="alert">{error}</p>}

      <button type="submit" disabled={pending}>
        {pending ? "Creating..." : "Create league"}
      </button>
    </form>
  );
}
