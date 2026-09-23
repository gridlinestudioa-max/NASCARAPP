import type { ReactNode } from "react";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import UserAvatar from "@/components/ui/UserAvatar";
import TabbedPanel from "@/components/ui/TabbedPanel";
import { CheckeredFlagIcon } from "@/components/ui/icons";
import TrendChart from "@/components/league/TrendChart";
import { displayRaceName } from "@/lib/raceName";
import { parseRuleSetConfig } from "@/lib/scoring";
import { parseTieredDraftRuleSetConfig, TIERED_LINEUP_SLOTS } from "@/lib/tieredDraft";
import {
  computeWeeklyTotals,
  scoredRacesInOrder,
  computePlayerSeasonStats,
  computeTrendSeries,
  computeDriverStats,
  computeDriverOwnership,
} from "@/lib/leagueStats";
import { getLeagueHubData, type LeagueHubData } from "../leagueData";
import styles from "./page.module.css";

export const dynamic = "force-dynamic";

// Wraps the shared placeholder icon in this page's badge styling — a
// stand-in for a real per-race logo (not available yet).
function RaceRowIcon() {
  return (
    <span className={styles.raceIcon}>
      <CheckeredFlagIcon />
    </span>
  );
}

function renderPersonalLimitCard(data: LeagueHubData, userId: string): ReactNode {
  const { league, leagueSeason, picks } = data;
  const myPicks = picks.filter((p) => p.userId === userId);

  if (league.type === "TIERED_DRAFT") {
    // Tiered Lineup always has a starts cap (it's a required config field,
    // never null), so this card is always relevant for that league type.
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
  // No per-driver cap configured — there's nothing to track against, so
  // skip this card entirely instead of showing an "unlimited" placeholder.
  if (max == null) return null;

  const countByDriver = new Map<string, number>();
  for (const p of myPicks) {
    countByDriver.set(p.driver.name, (countByDriver.get(p.driver.name) ?? 0) + 1);
  }
  const rows = [...countByDriver.entries()].sort((a, b) => b[1] - a[1]);

  return (
    <Card title="Your Driver Limits">
      <p>Each driver can be picked up to {max} time(s) this season.</p>
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

function renderPersonalStatsCard(data: LeagueHubData, userId: string): ReactNode {
  const { league, races, picks } = data;
  const raceByWeek = new Map(races.map((r) => [r.id, r]));
  const myPicks = picks.filter((p) => p.userId === userId);
  const totalScore = myPicks.reduce((sum, p) => sum + (p.score?.total ?? 0), 0);

  if (league.type === "TIERED_DRAFT") {
    // 8 picks/week (starters + bench) is too granular for a summary —
    // roll each week up to its total instead.
    const byRace = new Map<string, { week: number; trackName: string; total: number }>();
    for (const p of myPicks) {
      const race = raceByWeek.get(p.raceId);
      if (!race) continue;
      const existing = byRace.get(p.raceId) ?? { week: race.week, trackName: race.trackName, total: 0 };
      existing.total += p.score?.total ?? 0;
      byRace.set(p.raceId, existing);
    }
    const weeks = [...byRace.values()].sort((a, b) => a.week - b.week);

    return (
      <Card title="Personal Stats">
        <p className={styles.cardSub}>
          Season total <strong>{totalScore}</strong> across {weeks.length} race(s)
          {weeks.length > 0 && (
            <>
              {" "}
              — avg <strong>{(totalScore / weeks.length).toFixed(1)}</strong>/wk
            </>
          )}
          .
        </p>
        {weeks.length === 0 ? (
          <p>No lineups have been scored yet this season.</p>
        ) : (
          <ul className={`rowList ${styles.raceList}`}>
            {weeks.map((w) => (
              <li key={w.week}>
                <span className={styles.raceRowMain}>
                  <RaceRowIcon />
                  <span className={styles.raceRowLabel}>{displayRaceName(w.trackName)}</span>
                </span>
                <strong className={styles.accentCell}>{w.total}</strong>
              </li>
            ))}
          </ul>
        )}
      </Card>
    );
  }

  const scoredCount = myPicks.filter((p) => p.score).length;

  return (
    <Card title="Personal Stats">
      <p className={styles.cardSub}>
        Season total <strong>{totalScore}</strong> across {myPicks.length} pick(s)
        {scoredCount > 0 && (
          <>
            {" "}
            — avg <strong>{(totalScore / scoredCount).toFixed(1)}</strong>/pick
          </>
        )}
        .
      </p>
      {myPicks.length === 0 ? (
        <p>You haven&apos;t made a pick yet this season.</p>
      ) : (
        <ul className={`rowList ${styles.raceList}`}>
          {myPicks
            .slice()
            .sort((a, b) => (raceByWeek.get(a.raceId)?.week ?? 0) - (raceByWeek.get(b.raceId)?.week ?? 0))
            .map((p) => (
              <li key={p.id}>
                <span className={styles.raceRowMain}>
                  <RaceRowIcon />
                  <span className={styles.raceRowText}>
                    <span className={styles.raceRowLabel}>
                      {raceByWeek.get(p.raceId) ? displayRaceName(raceByWeek.get(p.raceId)!.trackName) : "—"}
                    </span>
                    <span className={styles.raceRowSub}>
                      {p.driver.name}
                      {p.score?.finishPosition != null && ` — finished ${p.score.finishPosition}`}
                    </span>
                  </span>
                </span>
                <strong className={styles.accentCell}>{p.score?.total ?? "—"}</strong>
              </li>
            ))}
        </ul>
      )}
    </Card>
  );
}

export default async function LeagueStatsTabPage(props: { params: Promise<{ leagueId: string }> }) {
  const { leagueId } = await props.params;

  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }
  const userId = session.user.id;

  const data = await getLeagueHubData(leagueId, userId);
  if (!data) {
    notFound();
  }

  const { picks, races, members } = data;
  const raceByWeek = new Map(races.map((r) => [r.id, r]));
  const avatarByUserId = new Map(members.map((m) => [m.userId, m.user.avatarUrl]));

  const weekly = computeWeeklyTotals(races, picks);
  const scoredRaces = scoredRacesInOrder(races, weekly);
  const playerStats = computePlayerSeasonStats(members, scoredRaces, weekly, picks);
  const trend = computeTrendSeries(members, scoredRaces, weekly);
  const momentumSorted = playerStats
    .filter((p) => p.momentum != null)
    .sort((a, b) => (b.momentum ?? 0) - (a.momentum ?? 0));

  const scored = picks.filter((p) => p.score);
  const totalPoints = scored.reduce((sum, p) => sum + (p.score?.total ?? 0), 0);
  const avg = scored.length > 0 ? totalPoints / scored.length : 0;

  const driverCounts = new Map<string, number>();
  for (const p of picks) {
    driverCounts.set(p.driver.name, (driverCounts.get(p.driver.name) ?? 0) + 1);
  }
  const mostPicked = [...driverCounts.entries()].sort((a, b) => b[1] - a[1])[0];
  const best = scored.slice().sort((a, b) => (b.score?.total ?? 0) - (a.score?.total ?? 0))[0];

  const leagueStatCards = [
    { label: "Total picks scored", value: scored.length.toLocaleString() },
    { label: "Average score per pick", value: avg.toFixed(1) },
    mostPicked && { label: "Most-picked driver", value: `${mostPicked[0]} (${mostPicked[1]}×)` },
    best && {
      label: "Best single score",
      value: `${best.score?.total} — ${best.user.name ?? best.user.email}, W${raceByWeek.get(best.raceId)?.week ?? "—"}`,
    },
  ].filter(Boolean) as { label: string; value: string }[];

  const consistencySorted = playerStats.slice().sort((a, b) => b.consistencyScore - a.consistencyScore);
  const stageSorted = playerStats.slice().sort((a, b) => b.total - a.total);

  const driverStats = computeDriverStats(picks).sort((a, b) => b.timesPicked - a.timesPicked);
  const driverValue = driverStats.slice().sort((a, b) => b.avgPts - a.avgPts);
  const maxAvg = Math.max(0, ...driverValue.map((d) => d.avgPts));
  const diversity = members
    .map((m) => ({
      userId: m.userId,
      name: m.user.name ?? m.user.email,
      uniqueDrivers: new Set(picks.filter((p) => p.userId === m.userId).map((p) => p.driverId)).size,
    }))
    .sort((a, b) => b.uniqueDrivers - a.uniqueDrivers);
  const nameByUserId = new Map(members.map((m) => [m.userId, m.user.name ?? m.user.email]));
  const { ownership } = computeDriverOwnership(picks);
  // Who picked each driver most often, and how many times — folded
  // directly into the Most Picked Drivers row instead of a separate
  // per-player table.
  const topOwnerByDriver = new Map(
    driverStats.map((d) => {
      const byUser = ownership.get(d.name);
      const top = byUser ? [...byUser.entries()].sort((a, b) => b[1] - a[1])[0] : undefined;
      return [d.driverId, top ? { name: nameByUserId.get(top[0]) ?? "—", count: top[1] } : null] as const;
    }),
  );

  return (
    <>
      {scoredRaces.length > 0 && (
        <Card title="Points by week">
          <TrendChart labels={trend.labels} series={trend.totals} height={190} />
        </Card>
      )}

      {leagueStatCards.length > 0 && (
        <div className={styles.statGrid}>
          {leagueStatCards.map((c) => (
            <div key={c.label} className={styles.statCard}>
              <div className={styles.statValue}>{c.value}</div>
              <div className={styles.statLabel}>{c.label}</div>
            </div>
          ))}
        </div>
      )}

      <Card title="Player Stats">
        <TabbedPanel
          tabs={[
            momentumSorted.length > 0 && {
              id: "momentum",
              label: "Momentum",
              content: (
                <table key="momentum" className={styles.compactTable}>
                  <thead>
                    <tr>
                      <th>Player</th>
                      <th>Momentum</th>
                    </tr>
                  </thead>
                  <tbody>
                    {momentumSorted.map((p) => (
                      <tr key={p.userId}>
                        <td>
                          <span style={{ display: "inline-flex", alignItems: "center", gap: "8px" }}>
                            <UserAvatar name={p.name} avatarUrl={avatarByUserId.get(p.userId)} />
                            {p.name}
                          </span>
                        </td>
                        <td>
                          <Badge tone={(p.momentum ?? 0) >= 0 ? "success" : "danger"}>
                            {(p.momentum ?? 0) >= 0 ? "+" : ""}
                            {p.momentum}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ),
            },
            {
              id: "consistency",
              label: "Consistency",
              content:
                consistencySorted.length === 0 || scoredRaces.length === 0 ? (
                  <p key="consistency">No scored races yet this season.</p>
                ) : (
                  <table key="consistency" className={styles.compactTable}>
                    <thead>
                      <tr>
                        <th>Player</th>
                        <th className={styles.num}>Consistency</th>
                      </tr>
                    </thead>
                    <tbody>
                      {consistencySorted.map((p) => (
                        <tr key={p.userId}>
                          <td>{p.name}</td>
                          <td className={`${styles.num} ${styles.accentCell}`}>{p.consistencyScore.toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ),
            },
            {
              id: "stage",
              label: "Stage Points",
              content:
                stageSorted.length === 0 ? (
                  <p key="stage">No scored picks yet this season.</p>
                ) : (
                  <table key="stage" className={styles.compactTable}>
                    <thead>
                      <tr>
                        <th>Player</th>
                        <th className={styles.num}>Stage Points</th>
                      </tr>
                    </thead>
                    <tbody>
                      {stageSorted.map((p) => (
                        <tr key={p.userId}>
                          <td>{p.name}</td>
                          <td className={`${styles.num} ${styles.accentCell}`}>{p.stagePts}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ),
            },
            {
              id: "diversity",
              label: "Diversity",
              content: (
                <table key="diversity" className={styles.compactTable}>
                  <thead>
                    <tr>
                      <th>Player</th>
                      <th className={styles.num}>Unique Drivers</th>
                    </tr>
                  </thead>
                  <tbody>
                    {diversity.map((d) => (
                      <tr key={d.userId}>
                        <td>{d.name}</td>
                        <td className={styles.num}>{d.uniqueDrivers}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ),
            },
          ].filter(Boolean) as { id: string; label: string; content: ReactNode }[]}
        />
      </Card>

      {renderPersonalStatsCard(data, userId)}

      {renderPersonalLimitCard(data, userId)}

      <Card title="Drivers">
        <TabbedPanel
          tabs={[
            {
              id: "most-picked",
              label: "Most Picked",
              content:
                driverStats.length === 0 ? (
                  <p key="most-picked">No picks made yet this season.</p>
                ) : (
                  <table key="most-picked" className={styles.compactTable}>
                    <thead>
                      <tr>
                        <th>Driver</th>
                        <th>Picked most by</th>
                        <th className={styles.num}>Times picked</th>
                      </tr>
                    </thead>
                    <tbody>
                      {driverStats.map((d) => {
                        const topOwner = topOwnerByDriver.get(d.driverId);
                        return (
                          <tr key={d.driverId}>
                            <td>{d.name}</td>
                            <td className={styles.muted}>
                              {topOwner ? `${topOwner.name} · ${topOwner.count}×` : "—"}
                            </td>
                            <td className={`${styles.num} ${styles.accentCell}`}>{d.timesPicked}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                ),
            },
            {
              id: "value",
              label: "Value",
              content:
                driverValue.length === 0 ? (
                  <p key="value">No scored picks yet this season.</p>
                ) : (
                  <div key="value">
                    {driverValue.map((d) => (
                      <div key={d.driverId} className={styles.barRow}>
                        <div className={styles.barLabelRow}>
                          <span className={styles.barName}>{d.name}</span>
                          <span className={styles.barMeta}>
                            avg {d.avgPts.toFixed(1)} · {d.totalPts} pts · picked {d.timesPicked}×
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
                ),
            },
          ]}
        />
      </Card>
    </>
  );
}
