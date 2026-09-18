"use client";

import { useActionState, useState } from "react";
import { login } from "./actions";
import styles from "./LoginForm.module.css";

export default function LoginForm() {
  const [error, formAction, pending] = useActionState(login, undefined);
  const [showPassword, setShowPassword] = useState(false);

  return (
    <form action={formAction}>
      <div className={styles.field}>
        <label htmlFor="username">Username</label>
        <input id="username" name="username" type="text" required autoFocus autoComplete="username" />
      </div>

      <div className={styles.field}>
        <label htmlFor="password">Password</label>
        <div className={styles.passwordRow}>
          <input
            id="password"
            name="password"
            type={showPassword ? "text" : "password"}
            required
            autoComplete="current-password"
          />
          <button
            type="button"
            className={styles.eyeButton}
            onClick={() => setShowPassword((s) => !s)}
            aria-label={showPassword ? "Hide password" : "Show password"}
          >
            {showPassword ? (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
                <circle cx="12" cy="12" r="3" />
                <path d="M3 3l18 18" strokeLinecap="round" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {error && <p role="alert">{error}</p>}

      <button type="submit" disabled={pending} className={styles.submit}>
        {pending ? "Signing in..." : "Sign in"}
      </button>
    </form>
  );
}
