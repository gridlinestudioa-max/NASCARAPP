"use client";

import { useEffect, useState } from "react";
import styles from "./AppearanceForm.module.css";

const COLOR_MODE_KEY = "colorMode";

type ColorMode = "light" | "dark";

export default function AppearanceForm() {
  // Starts at "light" on both the server render and React's first client
  // render (which must match the server's — it can't know localStorage yet)
  // — the no-flash inline script in layout.tsx already applied the real
  // theme to <html> before paint, so the *page* never flashes light; only
  // this component's own button then corrects itself a tick later via the
  // effect below, without a hydration mismatch.
  const [mode, setMode] = useState<ColorMode>("light");

  useEffect(() => {
    // One-time read of a client-only source (localStorage) right after
    // mount — not syncing from a prop/state the lint rule is meant to
    // guard against, so a plain effect (rather than useSyncExternalStore)
    // is the right tool here.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMode(window.localStorage.getItem(COLOR_MODE_KEY) === "dark" ? "dark" : "light");
  }, []);

  function choose(next: ColorMode) {
    setMode(next);
    window.localStorage.setItem(COLOR_MODE_KEY, next);
    if (next === "dark") {
      document.documentElement.setAttribute("data-theme", "dark");
    } else {
      document.documentElement.removeAttribute("data-theme");
    }
  }

  return (
    <div className={styles.row}>
      <button
        type="button"
        onClick={() => choose("light")}
        className={mode === "light" ? `${styles.option} ${styles.optionActive}` : styles.option}
      >
        Light
      </button>
      <button
        type="button"
        onClick={() => choose("dark")}
        className={mode === "dark" ? `${styles.option} ${styles.optionActive}` : styles.option}
      >
        Dark
      </button>
    </div>
  );
}
