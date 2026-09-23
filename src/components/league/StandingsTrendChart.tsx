"use client";

import { useState } from "react";
import TrendChart, { type TrendSeries } from "./TrendChart";
import styles from "./StandingsTrendChart.module.css";

// The Standings tab's trend chart, toggled between two views of the same
// week-by-week data: Weekly Placement (each player's standings rank at
// that point in the season) and Point Differential (each player's gap to
// the leader) — the latter used to be its own always-visible chart on the
// Stats tab; it now lives here as the second toggle state instead.
export default function StandingsTrendChart({
  labels,
  places,
  diffs,
}: {
  labels: string[];
  places: TrendSeries[];
  diffs: TrendSeries[];
}) {
  const [mode, setMode] = useState<"places" | "diffs">("places");

  return (
    <div>
      <div className={styles.toggle}>
        <button
          type="button"
          className={mode === "places" ? `${styles.toggleBtn} ${styles.toggleBtnActive}` : styles.toggleBtn}
          onClick={() => setMode("places")}
        >
          Weekly Placement
        </button>
        <button
          type="button"
          className={mode === "diffs" ? `${styles.toggleBtn} ${styles.toggleBtnActive}` : styles.toggleBtn}
          onClick={() => setMode("diffs")}
        >
          Point Differential
        </button>
      </div>
      <TrendChart labels={labels} series={mode === "places" ? places : diffs} yReversed={mode === "places"} />
    </div>
  );
}
