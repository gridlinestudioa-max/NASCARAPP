import type { ReactNode } from "react";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import TrendChart from "@/components/league/TrendChart";
import { parseRuleSetConfig } from "@/lib/scoring";
import { parseTieredDraftRuleSetConfig, TIERED_LINEUP_SLOTS } from "@/lib/tieredDraft";
import {
  computeWeeklyTotals,
  scoredRacesInOrder,
  computePlayerSeasonStats,
  computeTrendSeries,
  computeDriverStats,
  computeMostPickedByPlayer,
  computeDriverOwnership,
} from "@/lib/leagueStats";
import { getLeagueHubData, type LeagueHubData } from "../leagueData";
import styles from "./page.module.css";

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
      <Card title="Your Driver Limits" titlePlacement="outside">
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
    <Card title="Your Driver Limits" titlePlacement="outside">
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
      <Card title="Personal Stats" titlePlacement="outside">
        <p className={styles.cardSub}>Every driver you&apos;ve rostered this season, week by week.</p>
        <p>
          Season total <strong>{totalScore}</strong> across {weeks.length} race(s)
          {weeks.length > 0 && (
            <>
              {" "}
              — avg <strong>{(totalScore / weeks.length).toFixed(1)}</strong> per week
            </>
          )}
          .
        </p>
        {weeks.length === 0 ? (
          <p>No lineups have been scored yet this season.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Week</th>
                <th>Race</th>
                <th className={styles.num}>Total</th>
              </tr>
            </thead>
            <tbody>
              {weeks.map((w) => (
                <tr key={w.week}>
                  <td>{w.week}</td>
                  <td>{w.trackName}</td>
                  <td className={`${styles.num} ${styles.accentCell}`}>{w.total}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    );
  }

  const scoredCount = myPicks.filter((p) => p.score).length;

  return (
    <Card title="Personal Stats" titlePlacement="outside">
      <p className={styles.cardSub}>Every driver you&apos;ve picked this season, week by week.</p>
      <p>
        Season total <strong>{totalScore}</strong> across {myPicks.length} pick(s)
        {scoredCount > 0 && (
          <>
            {" "}
            — avg <strong>{(totalScore / scoredCount).toFixed(1)}</strong> per scored pick
          </>
        )}
        .
      </p>
      {myPicks.length === 0 ? (
        <p>You haven&apos;t made a pick yet this season.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Week</th>
              <th>Driver</th>
              <th className={styles.num}>Finish</th>
              <th className={styles.num}>Score</th>
            </tr>
          </thead>
          <tbody>
            {myPicks
              .slice()
              .sort((a, b) => (raceByWeek.get(a.raceId)?.week ?? 0) - (raceByWeek.get(b.raceId)?.week ?? 0))
              .map((p) => (
                <tr key={p.id}>
                  <td>{raceByWeek.get(p.raceId)?.week ?? "—"}</td>
                  <td>{p.driver.name}</td>
                  <td className={styles.num}>{p.score?.finishPosition ?? "—"}</td>
                  <td className={`${styles.num} ${styles.accentCell}`}>{p.score?.total ?? "—"}</td>
                </tr>
              ))}
          </tbody>
        </table>
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

  const weekly = computeWeeklyTotals(races, picks);
  const scoredRaces = scoredRacesInOrder(races, weekly);
  const playerStats = computePlayerSeasonStats(members, scoredRaces, weekly, picks);
  const trend = computeTrendSeries(members, scoredRaces, weekly);

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
      {scoredRaces.length > 0 && (
        <div className={styles.chartRow}>
          <Card title="Points by week" titlePlacement="outside">
            <TrendChart labels={trend.labels} series={trend.totals} />
          </Card>
          <Card title="Point differential by week" titlePlacement="outside">
            <TrendChart labels={trend.labels} series={trend.diffs} />
          </Card>
        </div>
      )}

      {renderPersonalStatsCard(data, userId)}

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

      <div className={styles.twoCol}>
        <Card title="Consistency" titlePlacement="outside">
          <p className={styles.cardSub}>
            Season average points per race, divided by standard deviation — higher means steadier output relative
            to their own average.
          </p>
          {consistencySorted.length === 0 || scoredRaces.length === 0 ? (
            <p>No scored races yet this season.</p>
          ) : (
            <table>
              <tbody>
                {consistencySorted.map((p) => (
                  <tr key={p.userId}>
                    <td>{p.name}</td>
                    <td className={`${styles.num} ${styles.accentCell}`}>{p.consistencyScore.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>

        <Card title="Stage Points" titlePlacement="outside">
          <p className={styles.cardSub}>Points earned from stage-end bonuses this season.</p>
          {stageSorted.length === 0 ? (
            <p>No scored picks yet this season.</p>
          ) : (
            <table>
              <tbody>
                {stageSorted.map((p) => (
                  <tr key={p.userId}>
                    <td>{p.name}</td>
                    <td className={`${styles.num} ${styles.accentCell}`}>{p.stagePts}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      </div>

      {renderPersonalLimitCard(data, userId)}

      <div className={styles.twoCol}>
        <Card title="Most Picked Drivers — League Wide" titlePlacement="outside">
          {driverStats.length === 0 ? (
            <p>No picks made yet this season.</p>
          ) : (
            <table>
              <tbody>
                {driverStats.map((d) => (
                  <tr key={d.driverId}>
                    <td>{d.name}</td>
                    <td className={`${styles.num} ${styles.accentCell}`}>{d.timesPicked}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>

        <Card title="Most Picked by Player" titlePlacement="outside">
          {favorites.every((f) => f.driverName == null) ? (
            <p>No picks made yet this season.</p>
          ) : (
            <table>
              <tbody>
                {favorites.map((f) => (
                  <tr key={f.userId}>
                    <td>{f.name}</td>
                    <td className={styles.num}>
                      {f.driverName ?? "—"} {f.count > 0 && `· ${f.count}×`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      </div>

      <Card title="Driver Value" titlePlacement="outside">
        <p className={styles.cardSub}>Points scored per time picked, league wide.</p>
        {driverValue.length === 0 ? (
          <p>No scored picks yet this season.</p>
        ) : (
          <div>
            {driverValue.map((d) => (
              <div key={d.driverId} className={styles.barRow}>
                <div className={styles.barLabelRow}>
                  <span className={styles.barName}>{d.name}</span>
                  <span className={styles.barMeta}>
                    avg {d.avgPts.toFixed(1)} · {d.totalPts} pts · picked {d.timesPicked}×
                  </span>
                </div>
                <div className={styles.barTrack}>
                  <div className={styles.barFill} style={{ width: `${maxAvg > 0 ? (d.avgPts / maxAvg) * 100 : 0}%` }} />
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card title="Driver Diversity" titlePlacement="outside">
        <table>
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
      </Card>

      <Card title="Driver Ownership" titlePlacement="outside">
        {drivers.length === 0 ? (
          <p>No picks made yet this season.</p>
        ) : (
          <>
            <div className={styles.scrollX}>
              <table>
                <thead>
                  <tr>
                    <th>Driver</th>
                    {members.map((m) => (
                      <th key={m.userId} className={styles.num}>
                        {m.user.name ?? m.user.email}
                      </th>
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
                            <td key={m.userId} className={styles.num}>
                              <span className={styles.heatCellEmpty}>–</span>
                            </td>
                          );
                        }
                        const intensity = count / maxOwnership;
                        return (
                          <td key={m.userId} className={styles.num}>
                            <span
                              className={styles.heatCell}
                              style={{
                                background: `rgba(7, 7, 7, ${0.1 + intensity * 0.45})`,
                                color: intensity > 0.5 ? "#ffffff" : "var(--text-primary)",
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
            <p className={styles.cardFootnote}>Darker cells mean a player drafted that driver more often this season.</p>
          </>
        )}
      </Card>
    </>
  );
}
