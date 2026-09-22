"use client";

import { useState } from "react";
import Modal, { ModalCloseButton } from "@/components/ui/Modal";
import styles from "./DriverStatsTable.module.css";

export type DriverStatRow = {
  driverId: string;
  driverName: string;
  team: string | null;
  number: number | null;
  bio: string | null;
  points: number;
  wins: number;
  top5: number;
  top10: number;
  races: number;
  avgFinish: number;
  inChase: boolean;
};

export default function DriverStatsTable({ drivers }: { drivers: DriverStatRow[] }) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = drivers.find((d) => d.driverId === selectedId) ?? null;

  return (
    <>
      <div className={styles.tableWrap}>
        <table>
          <thead>
            <tr>
              <th style={{ width: 36 }}>#</th>
              <th>Driver</th>
              <th className={styles.num}>Races</th>
              <th className={styles.num}>Wins</th>
              <th className={styles.num}>Top 5</th>
              <th className={styles.num}>Top 10</th>
              <th className={styles.num}>Avg Finish</th>
              <th className={styles.num}>Year Points</th>
            </tr>
          </thead>
          <tbody>
            {drivers.map((d, i) => (
              <tr
                key={d.driverId}
                onClick={() => setSelectedId(d.driverId)}
                className={d.inChase ? styles.chaseRow : undefined}
              >
                <td className={styles.rank}>{i + 1}</td>
                <td>
                  <div className={styles.driverCell}>
                    <span className={styles.avatar}>{d.driverName.charAt(0).toUpperCase()}</span>
                    <div>
                      <div className={styles.driverName}>{d.driverName}</div>
                      {d.team && <div className={styles.team}>{d.team}</div>}
                    </div>
                  </div>
                </td>
                <td className={styles.num}>{d.races}</td>
                <td className={styles.num}>{d.wins}</td>
                <td className={styles.num}>{d.top5}</td>
                <td className={styles.num}>{d.top10}</td>
                <td className={styles.num}>{d.avgFinish || "—"}</td>
                <td className={`${styles.num} ${styles.points}`}>{d.points.toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal open={selected != null} onClose={() => setSelectedId(null)}>
        {selected && (
          <>
            <div className={styles.photoSlot}>
              <span className={styles.photoLabel}>
                DRIVER PHOTO
                <br />
                {selected.driverName}
              </span>
              <ModalCloseButton onClick={() => setSelectedId(null)} className={styles.photoCloseButton} />
            </div>
            <div className={styles.modalBody}>
              <div className={styles.modalHeader}>
                <span className={styles.modalAvatar}>{selected.driverName.charAt(0).toUpperCase()}</span>
                <div>
                  <div className={styles.modalName}>{selected.driverName}</div>
                  <div className={styles.modalSub}>
                    {selected.team}
                    {selected.team && selected.number != null && " · "}
                    {selected.number != null && `No. ${selected.number}`}
                  </div>
                </div>
              </div>

              {selected.bio && <p className={styles.bio}>{selected.bio}</p>}

              <div className={styles.statGridPrimary}>
                <div>
                  <div className={styles.statValueAccent}>{selected.points.toLocaleString()}</div>
                  <div className={styles.statLabel}>Year Points</div>
                </div>
                <div>
                  <div className={styles.statValue}>{selected.wins}</div>
                  <div className={styles.statLabel}>Wins</div>
                </div>
                <div>
                  <div className={styles.statValue}>{selected.avgFinish || "—"}</div>
                  <div className={styles.statLabel}>Avg Finish</div>
                </div>
              </div>

              <div className={styles.statGridSecondary}>
                <div>
                  <div className={styles.statValueSmall}>{selected.races}</div>
                  <div className={styles.statLabel}>Races</div>
                </div>
                <div>
                  <div className={styles.statValueSmall}>{selected.top5}</div>
                  <div className={styles.statLabel}>Top 5</div>
                </div>
                <div>
                  <div className={styles.statValueSmall}>{selected.top10}</div>
                  <div className={styles.statLabel}>Top 10</div>
                </div>
              </div>
            </div>
          </>
        )}
      </Modal>
    </>
  );
}
