"use client";

import { useState } from "react";
import styles from "./RaceResultsTabs.module.css";

export type ResultRow = { pos: number; driver: string };

const TABS = [
  { key: "stage1", label: "Stage 1" },
  { key: "stage2", label: "Stage 2" },
  { key: "final", label: "Final" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

export default function RaceResultsTabs({
  stage1,
  stage2,
  final,
}: {
  stage1: ResultRow[];
  stage2: ResultRow[];
  final: ResultRow[];
}) {
  const [active, setActive] = useState<TabKey>("final");
  const rows = { stage1, stage2, final }[active];

  return (
    <div>
      <div className={styles.tabRow}>
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setActive(t.key)}
            className={active === t.key ? `${styles.tab} ${styles.tabActive}` : styles.tab}
          >
            {t.label}
          </button>
        ))}
      </div>
      {rows.length === 0 ? (
        <p className={styles.empty}>No results yet for this tab.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th style={{ width: 48 }}>Pos</th>
              <th>Driver</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.pos}>
                <td className={styles.posCell}>{r.pos}</td>
                <td className={styles.driverCell}>{r.driver}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
