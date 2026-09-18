"use client";

import { useActionState } from "react";
import { requestPasswordReset } from "./actions";

export default function ForgotPasswordForm() {
  const [result, formAction, pending] = useActionState(requestPasswordReset, undefined);

  return (
    <form action={formAction}>
      <div>
        <label htmlFor="username">Username</label>
        <br />
        <input id="username" name="username" type="text" required autoFocus autoComplete="username" />
      </div>

      {result && <p role={result.kind === "error" ? "alert" : "status"}>{result.message}</p>}

      <button type="submit" disabled={pending}>
        {pending ? "Sending..." : "Send reset link"}
      </button>
    </form>
  );
}
