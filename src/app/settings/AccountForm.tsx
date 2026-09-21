"use client";

import { useActionState } from "react";
import { updateAccount } from "./actions";

export default function AccountForm({ email, username }: { email: string; username: string }) {
  const [result, formAction, pending] = useActionState(updateAccount, undefined);

  return (
    <form action={formAction}>
      <div>
        <label htmlFor="email">Email</label>
        <br />
        <input id="email" name="email" type="email" defaultValue={email} required autoComplete="email" />
      </div>

      <div>
        <label htmlFor="username">Username</label>
        <br />
        <input
          id="username"
          name="username"
          type="text"
          defaultValue={username}
          required
          minLength={3}
          autoComplete="username"
        />
        <p>
          <small>This is what you sign in with.</small>
        </p>
      </div>

      <div>
        <label htmlFor="accountCurrentPassword">Current password</label>
        <br />
        <input
          id="accountCurrentPassword"
          name="currentPassword"
          type="password"
          required
          autoComplete="current-password"
        />
      </div>

      {result && <p role={result.kind === "error" ? "alert" : "status"}>{result.message}</p>}

      <button type="submit" disabled={pending}>
        {pending ? "Saving..." : "Save account"}
      </button>
    </form>
  );
}
