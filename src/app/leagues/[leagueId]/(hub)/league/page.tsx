import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import Card from "@/components/ui/Card";
import { parseRuleSetConfig } from "@/lib/scoring";
import { parseTieredDraftRuleSetConfig } from "@/lib/tieredDraft";
import { PICK_ORDER_MODE_INFO, type PickOrderMode } from "@/lib/pickOrder";
import { getLeagueHubData } from "../leagueData";
import FullScoreMatrix, { type MatrixRace } from "./FullScoreMatrix";
import styles from "./page.module.css";

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
  const nameByUserId = new Map(members.map((m) => [m.userId, m.user.name ?? m.user.email]));

  // Every field a race row needs, plus its click-to-expand breakdown —
  // built here so FullScoreMatrix (a client component, for the expand/
  // collapse state) only has to render, not re-derive any of this.
  const matrixRaces: MatrixRace[] = scoredRaces.map((r) => {
    const byUser = scoreByRaceUser.get(r.id)!;
    const rows = (picksByRace.get(r.id) ?? [])
      .slice()
      .sort((a, b) => (b.score?.total ?? 0) - (a.score?.total ?? 0));
    return {
      raceId: r.id,
      week: r.week,
      trackName: r.trackName,
      scores: Object.fromEntries(byUser),
      breakdown: rows.map((p) => ({
        userId: p.userId,
        playerName: nameByUserId.get(p.userId) ?? "—",
        driverName: p.driver.name,
        points: p.score?.total ?? 0,
        stageBonus: p.score?.stageBonus ?? 0,
      })),
    };
  });
  const matrixMembers = members.map((m) => ({ userId: m.userId, name: m.user.name ?? m.user.email }));

  return (
    <>
      <Card title="Full Score Matrix" className={styles.matrixCard}>
        <p className={styles.sub}>Every player&apos;s score, every week, this season — click a race to see the breakdown.</p>
        {scoredRaces.length === 0 ? (
          <p>No races have been scored yet this season.</p>
        ) : (
          <FullScoreMatrix
            members={matrixMembers}
            races={matrixRaces}
            totalByUser={Object.fromEntries(totalByUser)}
          />
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
    </>
  );
}
