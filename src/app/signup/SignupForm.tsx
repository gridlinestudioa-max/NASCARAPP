"use client";

import { useActionState } from "react";
import { signup } from "./actions";

export default function SignupForm() {
  const [error, formAction, pending] = useActionState(signup, undefined);

  return (
    <form action={formAction}>
      <div>
        <label htmlFor="email">Email</label>
        <br />
        <input id="email" name="email" type="email" required autoFocus />
      </div>

      <div>
        <label htmlFor="name">Display name</label>
        <br />
        <input id="name" name="name" type="text" />
      </div>

      <div>
        <label htmlFor="username">Username</label>
        <br />
        <input id="username" name="username" type="text" required minLength={3} />
      </div>

      <div>
        <label htmlFor="password">Password</label>
        <br />
        <input id="password" name="password" type="password" required minLength={8} />
      </div>

      <div>
        <label htmlFor="confirmPassword">Confirm password</label>
        <br />
        <input id="confirmPassword" name="confirmPassword" type="password" required minLength={8} />
      </div>

      {error && <p role="alert">{error}</p>}

      <button type="submit" disabled={pending}>
        {pending ? "Creating account..." : "Create account"}
      </button>
    </form>
  );
}
