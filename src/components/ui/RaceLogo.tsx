import { CheckeredFlagIcon } from "./icons";
import { getRaceLogo } from "@/lib/raceLogos";
import styles from "./RaceLogo.module.css";

// A small race-sponsor-logo badge, matching DriverNumberBadge's pattern:
// renders the bundled logo when this race has one (see lib/raceLogos.ts),
// falling back to the generic checkered-flag badge otherwise.
export default function RaceLogo({
  trackName,
  size = 32,
  className,
  overrideSrc,
}: {
  trackName: string;
  size?: number;
  className?: string;
  // An admin-pinned logo (Race.logoOverride) — bypasses trackName matching
  // entirely when set. See RACE_LOGO_OPTIONS in lib/raceLogos.ts.
  overrideSrc?: string | null;
}) {
  const src = overrideSrc ?? getRaceLogo(trackName);
  const wrapClassName = className ? `${styles.wrap} ${className}` : styles.wrap;

  if (!src) {
    return (
      <span className={wrapClassName} style={{ width: size, height: size }}>
        <CheckeredFlagIcon size={Math.round(size * 0.55)} />
      </span>
    );
  }

  return (
    <span className={wrapClassName} style={{ width: size, height: size }}>
      {/* eslint-disable-next-line @next/next/no-img-element -- small fixed set of bundled logos, rendered many times per page */}
      <img src={src} alt="" className={styles.img} />
    </span>
  );
}
