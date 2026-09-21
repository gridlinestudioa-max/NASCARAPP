"use client";

import { useActionState, useEffect, useRef } from "react";
import { updatePassword } from "./actions";

export default function PasswordForm() {
  const [result, formAction, pending] = useActionState(updatePassword, undefined);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (result?.kind === "status") {
      formRef.current?.reset();
    }
  }, [result]);

  return (
    <form ref={formRef} action={formAction}>
      <div>
        <label htmlFor="currentPassword">Current password</label>
        <br />
        <input id="currentPassword" name="currentPassword" type="password" required autoComplete="current-password" />
      </div>

      <div>
        <label htmlFor="newPassword">New password</label>
        <br />
        <input id="newPassword" name="newPassword" type="password" required minLength={8} autoComplete="new-password" />
      </div>

      <div>
        <label htmlFor="confirmNewPassword">Confirm new password</label>
        <br />
        <input
          id="confirmNewPassword"
          name="confirmPassword"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
        />
      </div>

      {result && <p role={result.kind === "error" ? "alert" : "status"}>{result.message}</p>}

      <button type="submit" disabled={pending}>
        {pending ? "Saving..." : "Change password"}
      </button>
    </form>
  );
}
