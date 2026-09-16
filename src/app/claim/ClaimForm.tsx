"use client";

import { useActionState } from "react";
import { claimAccount } from "./actions";

type UnclaimedUser = { id: string; name: string | null };

export default function ClaimForm({ users }: { users: UnclaimedUser[] }) {
  const [error, formAction, pending] = useActionState(claimAccount, undefined);

  if (users.length === 0) {
    return <p>Every account has already been claimed.</p>;
  }

  return (
    <form action={formAction}>
      <div>
        <label htmlFor="userId">You are</label>
        <br />
        <select id="userId" name="userId" required defaultValue="">
          <option value="" disabled>
            Select your name
          </option>
          {users.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name ?? u.id}
            </option>
          ))}
        </select>
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
        {pending ? "Claiming..." : "Claim account"}
      </button>
    </form>
  );
}
