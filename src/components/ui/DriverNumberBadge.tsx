import styles from "./DriverNumberBadge.module.css";

// The full-time Cup Series drivers we have a bundled number graphic for
// (public/driver-numbers/<number>.png) — everyone else (part-timers,
// substitutes, drivers without a synced number) falls back to the plain
// initial-letter badge below.
const AVAILABLE_NUMBERS = new Set([
  1, 2, 3, 4, 5, 6, 7, 9, 10, 11, 12, 16, 17, 19, 20, 21, 22, 23, 24, 34, 35, 38, 41, 42, 43, 45, 47, 48, 51, 54, 60,
  71, 77, 88, 97,
]);

// A small circular badge for a driver — shows their car number graphic
// when we have one bundled, their bare number when we don't, and falls
// back to the driver's initial when no number is known at all.
export default function DriverNumberBadge({
  number,
  name,
  className,
}: {
  number: number | null;
  name: string;
  className?: string;
}) {
  if (number != null && AVAILABLE_NUMBERS.has(number)) {
    return (
      <span className={className ? `${className} ${styles.imgBadge}` : styles.imgBadge}>
        {/* eslint-disable-next-line @next/next/no-img-element -- small fixed set of bundled per-number graphics */}
        <img src={`/driver-numbers/${number}.png`} alt={`#${number}`} className={styles.img} />
      </span>
    );
  }
  return <span className={className}>{number != null ? `#${number}` : name.charAt(0).toUpperCase()}</span>;
}
