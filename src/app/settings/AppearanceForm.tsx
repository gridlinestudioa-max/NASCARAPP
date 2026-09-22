"use client";

import { useState } from "react";
import styles from "./AppearanceForm.module.css";

const COLOR_MODE_KEY = "colorMode";

type ColorMode = "light" | "dark";

export default function AppearanceForm() {
  // Lazy initializer (not an effect) so this matches whatever the no-flash
  // inline script in layout.tsx already applied to <html> before this
  // component ever mounts — see "preventing-flash-before-hydration" in the
  // vendored Next docs.
  const [mode, setMode] = useState<ColorMode>(() => {
    if (typeof window === "undefined") return "light";
    return window.localStorage.getItem(COLOR_MODE_KEY) === "dark" ? "dark" : "light";
  });

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
