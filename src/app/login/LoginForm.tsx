"use client";

import { useActionState } from "react";
import { login } from "./actions";

export default function LoginForm() {
  const [error, formAction, pending] = useActionState(login, undefined);

  return (
    <form action={formAction}>
      <div>
        <label htmlFor="username">Username</label>
        <br />
        <input id="username" name="username" type="text" required autoFocus />
      </div>

      <div>
        <label htmlFor="password">Password</label>
        <br />
        <input id="password" name="password" type="password" required />
      </div>

      {error && <p role="alert">{error}</p>}

      <button type="submit" disabled={pending}>
        {pending ? "Signing in..." : "Sign in"}
      </button>
    </form>
  );
}
