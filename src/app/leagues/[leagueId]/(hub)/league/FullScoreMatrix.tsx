"use client";

import { Fragment, useState } from "react";
import RaceLogo from "@/components/ui/RaceLogo";
import DriverNumberBadge from "@/components/ui/DriverNumberBadge";
import { displayRaceName } from "@/lib/raceName";
import styles from "./page.module.css";

function ChevronIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export type MatrixMember = { userId: string; name: string };

export type MatrixBreakdownRow = {
  userId: string;
  playerName: string;
  driverName: string;
  driverNumber: number | null;
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

  // Mobile only (see .module.css) — the race x member grid needs a
  // horizontal swipe once a league has more than 2-3 players. This drives
  // a member-centric list instead: everyone's season total, visible at
  // once with no scrolling, with that member's race-by-race scores (and
  // the race names the grid dropped) available behind a tap.
  const [expandedMemberId, setExpandedMemberId] = useState<string | null>(null);
  const sortedMembers = [...members].sort((a, b) => (totalByUser[b.userId] ?? 0) - (totalByUser[a.userId] ?? 0));

  return (
    <>
      <div className={styles.mobileMatrix}>
        {sortedMembers.map((m, i) => {
          const expanded = expandedMemberId === m.userId;
          return (
            <div key={m.userId} className={styles.mobileMemberRow}>
              <button
                type="button"
                className={styles.mobileMemberHead}
                onClick={() => setExpandedMemberId(expanded ? null : m.userId)}
                aria-expanded={expanded}
              >
                <span className={styles.rank}>{i + 1}</span>
                <span className={styles.memberName}>{m.name}</span>
                <span className={styles.memberTotal}>{(totalByUser[m.userId] ?? 0).toLocaleString()}</span>
                <span className={expanded ? `${styles.chev} ${styles.chevOpen}` : styles.chev}>
                  <ChevronIcon />
                </span>
              </button>
              {expanded && (
                <div className={styles.mobileMemberDetail}>
                  {races.map((r) => (
                    <div key={r.raceId} className={styles.mobileMemberDetailRow}>
                      <span className={styles.raceCell}>
                        <RaceLogo trackName={r.trackName} size={22} className={styles.raceIcon} />
                        <span className={styles.raceName}>
                          Week {r.week} · {displayRaceName(r.trackName)}
                        </span>
                      </span>
                      <span className={styles.num}>{r.scores[m.userId] ?? "—"}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

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
                      <RaceLogo trackName={r.trackName} size={30} className={styles.raceIcon} />
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
                              <td>
                                <span className={styles.driverCell}>
                                  <DriverNumberBadge number={row.driverNumber} name={row.driverName} className={styles.driverBadge} />
                                  {row.driverName}
                                </span>
                              </td>
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
    </>
  );
}
