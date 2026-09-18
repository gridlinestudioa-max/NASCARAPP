import type { ReactNode } from "react";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import { parseRuleSetConfig } from "@/lib/scoring";
import { parseTieredDraftRuleSetConfig, TIERED_LINEUP_SLOTS } from "@/lib/tieredDraft";
import { computeDriverStats, computeMostPickedByPlayer, computeDriverOwnership } from "@/lib/leagueStats";
import { getLeagueHubData, type LeagueHubData } from "../leagueData";
import styles from "./DriverSelection.module.css";

export const dynamic = "force-dynamic";

function renderPersonalLimitCard(data: LeagueHubData, userId: string): ReactNode {
  const { league, leagueSeason, picks } = data;
  const myPicks = picks.filter((p) => p.userId === userId);

  if (league.type === "TIERED_DRAFT") {
    const config = leagueSeason ? parseTieredDraftRuleSetConfig(leagueSeason.ruleSet.config) : null;
    const starterSlotNumbers = new Set(
      TIERED_LINEUP_SLOTS.filter((s) => s.role === "STARTER").map((s) => s.pickNumber),
    );
    const startsByDriver = new Map<string, number>();
    for (const p of myPicks) {
      if (!starterSlotNumbers.has(p.pickNumber)) continue;
      startsByDriver.set(p.driver.name, (startsByDriver.get(p.driver.name) ?? 0) + 1);
    }
    const rows = [...startsByDriver.entries()].sort((a, b) => b[1] - a[1]);
    const max = config?.maxStartsPerDriverPerSeason ?? null;

    return (
      <Card title="Your Driver Limits">
        <p>
          Starts used per driver this season{max != null ? ` — limit ${max} start(s) each` : ""}. Benching a
          driver doesn&apos;t count against this cap, only starting them does.
        </p>
        {rows.length === 0 ? (
          <p>No starts recorded yet.</p>
        ) : (
          <ul className="rowList">
            {rows.map(([name, count]) => (
              <li key={name}>
                {name}
                <Badge tone={max != null && count >= max ? "warning" : "neutral"}>
                  {count}
                  {max != null ? ` of ${max}` : ""}
                  {max != null && count >= max ? " — limit reached" : ""}
                </Badge>
              </li>
            ))}
          </ul>
        )}
      </Card>
    );
  }

  const config = leagueSeason ? parseRuleSetConfig(leagueSeason.ruleSet.config) : null;
  const max = config?.maxPicksPerDriverPerSeason ?? null;
  const countByDriver = new Map<string, number>();
  for (const p of myPicks) {
    countByDriver.set(p.driver.name, (countByDriver.get(p.driver.name) ?? 0) + 1);
  }
  const rows = [...countByDriver.entries()].sort((a, b) => b[1] - a[1]);

  return (
    <Card title="Your Driver Limits">
      <p>
        {max == null
          ? "Unlimited repeat picks — no per-driver cap this season."
          : `Each driver can be picked up to ${max} time(s) this season.`}
      </p>
      {rows.length === 0 ? (
        <p>You haven&apos;t made a pick yet this season.</p>
      ) : (
        <ul className="rowList">
          {rows.map(([name, count]) => (
            <li key={name}>
              {name}
              <Badge tone={max != null && count >= max ? "warning" : "neutral"}>
                {count}
                {max != null ? ` of ${max}` : ""}
                {max != null && count >= max ? " — limit reached" : ""}
              </Badge>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

export default async function DriverSelectionPage(props: { params: Promise<{ leagueId: string }> }) {
  const { leagueId } = await props.params;

  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const data = await getLeagueHubData(leagueId, session.user.id);
  if (!data) {
    notFound();
  }

  const { members, picks } = data;

  const driverStats = computeDriverStats(picks).sort((a, b) => b.timesPicked - a.timesPicked);
  const driverValue = driverStats.slice().sort((a, b) => b.avgPts - a.avgPts);
  const maxAvg = Math.max(0, ...driverValue.map((d) => d.avgPts));
  const favorites = computeMostPickedByPlayer(members, picks);
  const diversity = members
    .map((m) => ({
      userId: m.userId,
      name: m.user.name ?? m.user.email,
      uniqueDrivers: new Set(picks.filter((p) => p.userId === m.userId).map((p) => p.driverId)).size,
    }))
    .sort((a, b) => b.uniqueDrivers - a.uniqueDrivers);
  const { drivers, ownership } = computeDriverOwnership(picks);
  const maxOwnership = Math.max(1, ...drivers.map((d) => Math.max(...members.map((m) => ownership.get(d)?.get(m.userId) ?? 0))));

  return (
    <>
      {renderPersonalLimitCard(data, session.user.id)}

      <Card title="Most Picked Drivers">
        {driverStats.length === 0 ? (
          <p>No picks made yet this season.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Driver</th>
                <th>Times Picked</th>
              </tr>
            </thead>
            <tbody>
              {driverStats.map((d) => (
                <tr key={d.driverId}>
                  <td>{d.name}</td>
                  <td>{d.timesPicked}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <Card title="Most Picked by Player">
        {favorites.every((f) => f.driverName == null) ? (
          <p>No picks made yet this season.</p>
        ) : (
          <div className={styles.picksGrid}>
            {favorites.map((f) => (
              <div key={f.userId} className={styles.pickTile}>
                <div className={styles.pickTilePlayer}>{f.name}</div>
                <div className={styles.pickTileDriver}>{f.driverName ?? "—"}</div>
                <div className={styles.pickTileCount}>{f.count > 0 ? `${f.count}x picked` : "no picks yet"}</div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card title="Driver Value">
        {driverValue.length === 0 ? (
          <p>No scored picks yet this season.</p>
        ) : (
          <div>
            {driverValue.map((d) => (
              <div key={d.driverId} className={styles.barRow}>
                <div className={styles.barLabelRow}>
                  <span className={styles.name}>{d.name}</span>
                  <span className={styles.meta}>
                    avg {d.avgPts.toFixed(1)} · {d.totalPts} pts · picked {d.timesPicked}x
                  </span>
                </div>
                <div className={styles.barTrack}>
                  <div
                    className={styles.barFill}
                    style={{ width: `${maxAvg > 0 ? (d.avgPts / maxAvg) * 100 : 0}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card title="Driver Diversity">
        <table>
          <thead>
            <tr>
              <th>Player</th>
              <th>Unique Drivers</th>
            </tr>
          </thead>
          <tbody>
            {diversity.map((d) => (
              <tr key={d.userId}>
                <td>{d.name}</td>
                <td>{d.uniqueDrivers}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <Card title="Driver Ownership">
        {drivers.length === 0 ? (
          <p>No picks made yet this season.</p>
        ) : (
          <>
            <div className={styles.heatWrap}>
              <table>
                <thead>
                  <tr>
                    <th>Driver</th>
                    {members.map((m) => (
                      <th key={m.userId}>{m.user.name ?? m.user.email}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {drivers.map((driverName) => (
                    <tr key={driverName}>
                      <td>{driverName}</td>
                      {members.map((m) => {
                        const count = ownership.get(driverName)?.get(m.userId) ?? 0;
                        if (count === 0) {
                          return (
                            <td key={m.userId}>
                              <span
                                className={styles.heatCell}
                                style={{ background: "var(--bg-surface-muted)", color: "var(--text-tertiary)" }}
                              >
                                –
                              </span>
                            </td>
                          );
                        }
                        const intensity = count / maxOwnership;
                        return (
                          <td key={m.userId}>
                            <span
                              className={styles.heatCell}
                              style={{
                                background: `rgba(7, 7, 7, ${0.1 + intensity * 0.45})`,
                                color: intensity > 0.5 ? "var(--text-on-ink)" : "var(--text-primary)",
                              }}
                            >
                              {count}
                            </span>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p style={{ marginTop: "var(--space-3)", fontSize: "0.8rem", color: "var(--text-secondary)" }}>
              Darker cells mean a player drafted that driver more often this season.
            </p>
          </>
        )}
      </Card>
    </>
  );
}
