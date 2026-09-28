"use client";

import styles from "./RangeSlider.module.css";

// A dual-handle range slider over integer indices [min, max]. Built from
// two overlapping native <input type="range"> elements rather than a
// custom pointer-drag implementation — see RangeSlider.module.css for why
// that's reliable without extra JS.
export default function RangeSlider({
  min,
  max,
  value,
  onChange,
  formatLabel,
  "aria-label": ariaLabel,
}: {
  min: number;
  max: number;
  value: [number, number];
  onChange: (value: [number, number]) => void;
  formatLabel?: (index: number) => string;
  "aria-label"?: string;
}) {
  const [low, high] = value;
  const span = Math.max(1, max - min);
  const lowPct = ((low - min) / span) * 100;
  const highPct = ((high - min) / span) * 100;
  const label = formatLabel ?? ((i: number) => String(i));

  return (
    <div className={styles.wrap}>
      <div className={styles.caption}>
        <span>{label(low)}</span>
        <span>{label(high)}</span>
      </div>
      <div className={styles.track}>
        <div className={styles.trackBase} />
        <div className={styles.trackRange} style={{ left: `${lowPct}%`, width: `${highPct - lowPct}%` }} />
        <input
          type="range"
          className={styles.rangeInput}
          min={min}
          max={max}
          step={1}
          value={low}
          aria-label={ariaLabel ? `${ariaLabel} start` : "Range start"}
          onChange={(e) => {
            const next = Math.min(Number(e.target.value), high);
            onChange([next, high]);
          }}
        />
        <input
          type="range"
          className={styles.rangeInput}
          min={min}
          max={max}
          step={1}
          value={high}
          aria-label={ariaLabel ? `${ariaLabel} end` : "Range end"}
          onChange={(e) => {
            const next = Math.max(Number(e.target.value), low);
            onChange([low, next]);
          }}
        />
      </div>
    </div>
  );
}
