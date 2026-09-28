"use client";

import { useState } from "react";
import Toggle from "@/components/ui/Toggle";
import TrendChart, { type TrendSeries } from "./TrendChart";
import styles from "./StandingsTrendChart.module.css";

// The Standings tab's trend chart, toggled between two views of the same
// week-by-week data: Weekly Placement (each player's standings rank at
// that point in the season) and Point Differential (each player's gap to
// the leader) — the latter used to be its own always-visible chart on the
// Stats tab; it now lives here as the second toggle state instead. A
// sliding switch reads better than tab buttons for exactly two opposite
// views of one chart, so it sits where the mode control naturally
// belongs: between the graph and its own title, right above the data it
// swaps out.
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
      <div className={styles.switchRow}>
        <Toggle
          checked={mode === "diffs"}
          onChange={(on) => setMode(on ? "diffs" : "places")}
          leftLabel="Weekly Placement"
          rightLabel="Point Differential"
          aria-label="Switch between weekly placement and point differential"
        />
      </div>
      <TrendChart labels={labels} series={mode === "places" ? places : diffs} yReversed={mode === "places"} />
    </div>
  );
}
