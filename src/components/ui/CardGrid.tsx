import type { ReactNode } from "react";
import styles from "./CardGrid.module.css";

// Wraps a handful of independent Cards (Settings' Appearance/Profile/
// Account/etc, a league hub tab's Standings+Trend, a race page's Results+
// Past winners...) so they sit side by side on a wide screen instead of
// stacking all the way down the page — the layout AppShell's contentInner
// (see globals note on max-width) was widened for. Not for a card that
// wraps a single wide table/matrix — those still want the full row to
// themselves, so just don't put them in here.
export default function CardGrid({ children }: { children: ReactNode }) {
  return <div className={styles.grid}>{children}</div>;
}
