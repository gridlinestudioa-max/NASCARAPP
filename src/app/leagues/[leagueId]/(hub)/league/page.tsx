import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import Card from "@/components/ui/Card";
import { parseRuleSetConfig } from "@/lib/scoring";
import { parseTieredDraftRuleSetConfig } from "@/lib/tieredDraft";
import { PICK_ORDER_MODE_INFO, type PickOrderMode } from "@/lib/pickOrder";
import { getLeagueHubData } from "../leagueData";
import styles from "./page.module.css";
import raceBreakdownStyles from "./RaceBreakdown.module.css";

export const dynamic = "force-dynamic";

function describePickemRules(config: ReturnType<typeof parseRuleSetConfig>, pickOrderMode: PickOrderMode): string[] {
  const rules: string[] = [
    `Draft order: ${PICK_ORDER_MODE_INFO[pickOrderMode].description}`,
    config.picksPerWeek > 1
      ? `Each player picks ${config.picksPerWeek} drivers per race, one turn at a time in draft order.`
      : "Each player picks one driver per race, in turn order — no two players can take the same driver.",
    config.pointsMode === "fixed"
      ? "Points are awarded from a fixed points table by finishing position."
      : "Points scale with the race's field size — 1st place is worth however many cars started.",
  ];
  if (config.includeStagePoints) rules.push("Top-10 stage finishers earn bonus stage points.");
  if (config.includeWinnerBonus) rules.push(`Winning a race adds a further ${config.winnerBonus} bonus points.`);
  rules.push(
    config.maxPicksPerDriverPerSeason != null
      ? `Each driver can be picked at most ${config.maxPicksPerDriverPerSeason} time(s) per player this season.`
      : "There's no per-driver pick limit — the same driver can be picked repeatedly, just not by two players in the same week.",
  );
  rules.push(
    config.lockTiming === "beforeQualifying"
      ? "Picks lock at the start of qualifying."
      : "Picks lock 5 minutes before the race starts, so they can be informed by qualifying.",
  );
  return rules;
}

function describeTieredRules(config: ReturnType<typeof parseTieredDraftRuleSetConfig>): string[] {
  return [
    "Each week, roster 4 starters — one Tier A, two Tier B, one Tier C — plus a matching bench driver for each.",
    "Starters earn qualifying and finish points; bench drivers earn qualifying points only.",
    `Each driver can be started at most ${config.maxStartsPerDriverPerSeason} time(s) per player this season — benching a driver doesn't count against the cap.`,
    "Late swaps are allowed up to 5 minutes before the race, but only within the same tier's starter/bench pair.",
  ];
}

export default async function LeagueTabPage(props: { params: Promise<{ leagueId: string }> }) {
  const { leagueId } = await props.params;

  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const data = await getLeagueHubData(leagueId, session.user.id);
  if (!data) {
    notFound();
  }

  const { league, leagueSeason, races, members, picks } = data;

  const rules = leagueSeason
    ? league.type === "TIERED_DRAFT"
      ? describeTieredRules(parseTieredDraftRuleSetConfig(leagueSeason.ruleSet.config))
      : describePickemRules(parseRuleSetConfig(leagueSeason.ruleSet.config), league.pickOrderMode as PickOrderMode)
    : [];

  // race -> user -> total score that week
  const scoreByRaceUser = new Map<string, Map<string, number>>();
  for (const p of picks) {
    if (!p.score) continue;
    const byUser = scoreByRaceUser.get(p.raceId) ?? new Map<string, number>();
    byUser.set(p.userId, (byUser.get(p.userId) ?? 0) + p.score.total);
    scoreByRaceUser.set(p.raceId, byUser);
  }
  const scoredRaces = races.filter((r) => scoreByRaceUser.has(r.id));
  const totalByUser = new Map<string, number>();
  for (const byUser of scoreByRaceUser.values()) {
    for (const [userId, total] of byUser) {
      totalByUser.set(userId, (totalByUser.get(userId) ?? 0) + total);
    }
  }

  const picksByRace = new Map<string, typeof picks>();
  for (const p of picks) {
    if (!p.score) continue;
    const list = picksByRace.get(p.raceId) ?? [];
    list.push(p);
    picksByRace.set(p.raceId, list);
  }
  const mostRecentFirst = scoredRaces.slice().sort((a, b) => b.week - a.week);
  const nameByUserId = new Map(members.map((m) => [m.userId, m.user.name ?? m.user.email]));

  return (
    <>
      <Card title="Full Score Matrix" className={styles.matrixCard}>
        <p className={styles.sub}>Every player&apos;s score, every week, this season.</p>
        {scoredRaces.length === 0 ? (
          <p>No races have been scored yet this season.</p>
        ) : (
          <div className={styles.scrollX}>
            <table>
              <thead>
                <tr>
                  <th className={styles.sticky}>Week</th>
                  {members.map((m) => (
                    <th key={m.userId} className={styles.num}>
                      {m.user.name ?? m.user.email}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {scoredRaces.map((r) => {
                  const byUser = scoreByRaceUser.get(r.id)!;
                  return (
                    <tr key={r.id}>
                      <td className={styles.sticky}>Wk {r.week}</td>
                      {members.map((m) => (
                        <td key={m.userId} className={styles.num}>
                          {byUser.get(m.userId) ?? "—"}
                        </td>
                      ))}
                    </tr>
                  );
                })}
                <tr>
                  <td className={`${styles.sticky} ${styles.totalRow}`}>Total</td>
                  {members.map((m) => (
                    <td key={m.userId} className={`${styles.num} ${styles.totalRow} ${styles.accentCell}`}>
                      {totalByUser.get(m.userId) ?? 0}
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card title="League Rules">
        <div className={styles.rulesList}>
          {rules.map((rule, i) => (
            <div key={i} className={styles.ruleRow}>
              <span className={styles.ruleDash}>—</span>
              <span>{rule}</span>
            </div>
          ))}
        </div>
      </Card>

      {mostRecentFirst.length > 0 && (
        <Card title="Race-by-Race Breakdown">
          <div className={raceBreakdownStyles.raceList}>
            {mostRecentFirst.map((r) => {
              const rows = (picksByRace.get(r.id) ?? [])
                .slice()
                .sort((a, b) => (b.score?.total ?? 0) - (a.score?.total ?? 0));
              return (
                <details key={r.id} className={raceBreakdownStyles.raceItem}>
                  <summary className={raceBreakdownStyles.summary}>
                    <div>
                      <div className={raceBreakdownStyles.trackName}>{r.trackName}</div>
                      <div className={raceBreakdownStyles.raceNum}>Week {r.week}</div>
                    </div>
                    <svg
                      className={raceBreakdownStyles.chev}
                      width="18"
                      height="18"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      aria-hidden="true"
                    >
                      <path d="M9 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </summary>
                  <table>
                    <thead>
                      <tr>
                        <th>Player</th>
                        <th>Driver</th>
                        <th>Points</th>
                        <th>Stage</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((p) => (
                        <tr key={p.id}>
                          <td>{nameByUserId.get(p.userId) ?? "—"}</td>
                          <td>{p.driver.name}</td>
                          <td>{p.score?.total}</td>
                          <td>{(p.score?.stageBonus ?? 0) > 0 ? `+${p.score?.stageBonus}` : "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </details>
              );
            })}
          </div>
        </Card>
      )}
    </>
  );
}
