"use client";

import { useState } from "react";
import MiniTabs from "@/components/ui/MiniTabs";
import DriverNumberBadge from "@/components/ui/DriverNumberBadge";
import styles from "./RaceResultsTabs.module.css";

export type ResultRow = { pos: number; driver: string; driverNumber: number | null };

const TABS = [
  { id: "stage1", label: "Stage 1" },
  { id: "stage2", label: "Stage 2" },
  { id: "final", label: "Final" },
] as const;

type TabKey = (typeof TABS)[number]["id"];

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
      <MiniTabs tabs={[...TABS]} active={active} onChange={(id) => setActive(id as TabKey)} />
      {rows.length === 0 ? (
        <p className={styles.empty}>No results yet for this tab.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th style={{ width: 48, textAlign: "center" }}>Pos</th>
              <th>Driver</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.pos}>
                <td className={styles.posCell}>{r.pos}</td>
                <td className={styles.driverCell}>
                  <DriverNumberBadge number={r.driverNumber} name={r.driver} className={styles.driverBadge} />
                  {r.driver}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
