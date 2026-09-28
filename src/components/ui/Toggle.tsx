"use client";

import styles from "./Toggle.module.css";

// A sliding pill switch (knob glides left/right on a spring-y ease) —
// the animated counterpart to MiniTabs' pill buttons, for spots where two
// states are genuinely opposite ends of one dial (e.g. two views of the
// same chart) rather than a list of tabs.
export default function Toggle({
  checked,
  onChange,
  leftLabel,
  rightLabel,
  "aria-label": ariaLabel,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  leftLabel?: string;
  rightLabel?: string;
  "aria-label"?: string;
}) {
  return (
    <span className={styles.wrap}>
      {leftLabel && (
        <span className={!checked ? `${styles.label} ${styles.labelActive}` : styles.label}>{leftLabel}</span>
      )}
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={ariaLabel}
        className={checked ? `${styles.track} ${styles.trackOn}` : styles.track}
        onClick={() => onChange(!checked)}
      >
        <span className={styles.knob} />
      </button>
      {rightLabel && (
        <span className={checked ? `${styles.label} ${styles.labelActive}` : styles.label}>{rightLabel}</span>
      )}
    </span>
  );
}
