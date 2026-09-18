"use client";

import { useActionState } from "react";
import { resetPassword } from "./actions";

export default function ResetPasswordForm({ token }: { token: string }) {
  const [error, formAction, pending] = useActionState(resetPassword, undefined);

  return (
    <form action={formAction}>
      <input type="hidden" name="token" value={token} />

      <div>
        <label htmlFor="password">New password</label>
        <br />
        <input id="password" name="password" type="password" required minLength={8} autoFocus autoComplete="new-password" />
      </div>

      <div>
        <label htmlFor="confirmPassword">Confirm new password</label>
        <br />
        <input
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
        />
      </div>

      {error && <p role="alert">{error}</p>}

      <button type="submit" disabled={pending}>
        {pending ? "Saving..." : "Set new password"}
      </button>
    </form>
  );
}
