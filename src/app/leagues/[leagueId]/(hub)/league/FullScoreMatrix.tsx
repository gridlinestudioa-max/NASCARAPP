"use client";

import { Fragment, useState } from "react";
import RaceLogo from "@/components/ui/RaceLogo";
import { displayRaceName } from "@/lib/raceName";
import styles from "./page.module.css";

export type MatrixMember = { userId: string; name: string };

export type MatrixBreakdownRow = {
  userId: string;
  playerName: string;
  driverName: string;
  points: number;
  stageBonus: number;
};

export type MatrixRace = {
  raceId: string;
  week: number;
  trackName: string;
  scores: Record<string, number>;
  breakdown: MatrixBreakdownRow[];
};

export default function FullScoreMatrix({
  members,
  races,
  totalByUser,
}: {
  members: MatrixMember[];
  races: MatrixRace[];
  totalByUser: Record<string, number>;
}) {
  const [expandedRaceId, setExpandedRaceId] = useState<string | null>(null);

  return (
    <div className={styles.scrollX}>
      <table>
        <thead>
          <tr>
            <th className={styles.sticky}>Week</th>
            {members.map((m) => (
              <th key={m.userId} className={styles.playerCol}>
                {m.name}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {races.map((r) => {
            const isOpen = expandedRaceId === r.raceId;
            return (
              <Fragment key={r.raceId}>
                <tr
                  className={styles.matrixRow}
                  onClick={() => setExpandedRaceId(isOpen ? null : r.raceId)}
                  aria-expanded={isOpen}
                >
                  <td className={styles.sticky}>
                    <span className={styles.raceCell}>
                      <svg
                        className={isOpen ? `${styles.chev} ${styles.chevOpen}` : styles.chev}
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        aria-hidden="true"
                      >
                        <path d="M9 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                      <RaceLogo trackName={r.trackName} size={22} className={styles.raceIcon} />
                      <span className={styles.raceName}>{displayRaceName(r.trackName)}</span>
                    </span>
                  </td>
                  {members.map((m) => (
                    <td key={m.userId} className={styles.playerCol}>
                      {r.scores[m.userId] ?? "—"}
                    </td>
                  ))}
                </tr>
                {isOpen && (
                  <tr>
                    <td colSpan={members.length + 1} className={styles.matrixDetailCell}>
                      <table className={styles.detailTable}>
                        <thead>
                          <tr>
                            <th>Player</th>
                            <th>Driver</th>
                            <th>Points</th>
                            <th>Stage</th>
                          </tr>
                        </thead>
                        <tbody>
                          {r.breakdown.map((row, i) => (
                            <tr key={`${row.userId}-${i}`}>
                              <td>{row.playerName}</td>
                              <td>{row.driverName}</td>
                              <td>{row.points}</td>
                              <td>{row.stageBonus > 0 ? `+${row.stageBonus}` : "—"}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
          <tr>
            <td className={`${styles.sticky} ${styles.totalRow}`}>Total</td>
            {members.map((m) => (
              <td key={m.userId} className={`${styles.playerCol} ${styles.totalRow} ${styles.accentCell}`}>
                {totalByUser[m.userId] ?? 0}
              </td>
            ))}
          </tr>
        </tbody>
      </table>
    </div>
  );
}
