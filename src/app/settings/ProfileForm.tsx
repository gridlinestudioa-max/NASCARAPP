"use client";

import { useActionState } from "react";
import { updateProfile } from "./actions";

export default function ProfileForm({ name }: { name: string }) {
  const [result, formAction, pending] = useActionState(updateProfile, undefined);

  return (
    <form action={formAction}>
      <div>
        <label htmlFor="name">Display name</label>
        <br />
        <input id="name" name="name" type="text" defaultValue={name} placeholder="Shown across all your leagues" />
      </div>

      {result && <p role={result.kind === "error" ? "alert" : "status"}>{result.message}</p>}

      <button type="submit" disabled={pending}>
        {pending ? "Saving..." : "Save display name"}
      </button>
    </form>
  );
}
