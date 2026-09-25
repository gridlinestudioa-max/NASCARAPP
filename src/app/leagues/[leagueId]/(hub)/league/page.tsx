import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
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

// Sums every scored pick for one season into a per-user total — used both
// for the current season (already loaded via getLeagueHubData) and for a
// past season pulled fresh here, so "who won year X" can be answered
// without keeping a separate standings table.
async function computeSeasonChampion(
  leagueId: string,
  seasonId: string,
  nameByUserId: Map<string, string>,
): Promise<{ name: string; total: number } | null> {
  const races = await prisma.race.findMany({ where: { seasonId }, select: { id: true } });
  if (races.length === 0) return null;
  const picks = await prisma.pick.findMany({
    where: { leagueId, raceId: { in: races.map((r) => r.id) } },
    include: { score: true },
  });
  const totalByUser = new Map<string, number>();
  for (const p of picks) {
    if (!p.score) continue;
    totalByUser.set(p.userId, (totalByUser.get(p.userId) ?? 0) + p.score.total);
  }
  if (totalByUser.size === 0) return null;
  const [championUserId, total] = [...totalByUser.entries()].sort((a, b) => b[1] - a[1])[0];
  return { name: nameByUserId.get(championUserId) ?? "—", total };
}

export default async function LeagueTabPage(props: {
  params: Promise<{ leagueId: string }>;
  searchParams: Promise<{ season?: string }>;
}) {
  const { leagueId } = await props.params;
  const { season: seasonParam } = await props.searchParams;

  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const data = await getLeagueHubData(leagueId, session.user.id);
  if (!data) {
    notFound();
  }

  const { league, leagueSeason, members } = data;
  const nameByUserId = new Map(members.map((m) => [m.userId, m.user.name ?? m.user.email]));

  // Every season this league has ever taken part in — drives the year
  // tabs and the previous-winners table. A league with only one season
  // (the common case today) shows neither.
  const leagueSeasons = await prisma.leagueSeason.findMany({
    where: { leagueId },
    include: { season: true },
    orderBy: { season: { year: "desc" } },
  });
  const currentSeasonId = data.season?.id ?? null;
  const requestedYear = seasonParam ? Number(seasonParam) : null;
  const viewingSeasonRow =
    (requestedYear != null ? leagueSeasons.find((ls) => ls.season.year === requestedYear) : null) ??
    leagueSeasons.find((ls) => ls.seasonId === currentSeasonId) ??
    null;
  const isViewingCurrent = viewingSeasonRow?.seasonId === currentSeasonId;

  const [races, picks] = isViewingCurrent
    ? [data.races, data.picks]
    : await (async () => {
        if (!viewingSeasonRow) return [[], []] as [typeof data.races, typeof data.picks];
        const seasonRaces = await prisma.race.findMany({
          where: { seasonId: viewingSeasonRow.seasonId },
          orderBy: { week: "asc" },
        });
        const seasonPicks = await prisma.pick.findMany({
          where: { leagueId, raceId: { in: seasonRaces.map((r) => r.id) } },
          include: { score: true, driver: true, user: true },
        });
        return [seasonRaces, seasonPicks] as [typeof data.races, typeof data.picks];
      })();

  const rules =
    leagueSeason && isViewingCurrent
      ? league.type === "TIERED_DRAFT"
        ? describeTieredRules(parseTieredDraftRuleSetConfig(leagueSeason.ruleSet.config))
        : describePickemRules(parseRuleSetConfig(leagueSeason.ruleSet.config), league.pickOrderMode as PickOrderMode)
      : [];

  const pastSeasons = leagueSeasons.filter((ls) => ls.seasonId !== currentSeasonId);
  const previousWinners = (
    await Promise.all(
      pastSeasons.map(async (ls) => ({
        year: ls.season.year,
        champion: await computeSeasonChampion(leagueId, ls.seasonId, nameByUserId),
      })),
    )
  ).filter((w) => w.champion != null) as { year: number; champion: { name: string; total: number } }[];

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
        driverNumber: p.driver.number,
        points: p.score?.total ?? 0,
        stageBonus: p.score?.stageBonus ?? 0,
      })),
    };
  });
  const matrixMembers = members.map((m) => ({ userId: m.userId, name: m.user.name ?? m.user.email }));

  return (
    <>
      {previousWinners.length > 0 && (
        <Card title="Previous Winners">
          <table>
            <thead>
              <tr>
                <th>Season</th>
                <th>Champion</th>
                <th>Points</th>
              </tr>
            </thead>
            <tbody>
              {previousWinners.map((w) => (
                <tr key={w.year}>
                  <td>{w.year}</td>
                  <td>{w.champion.name}</td>
                  <td className={styles.num}>{w.champion.total.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      <Card title="Full Score Matrix" className={styles.matrixCard}>
        {leagueSeasons.length > 1 && (
          <div className={styles.yearTabs}>
            {leagueSeasons.map((ls) => (
              <Link
                key={ls.seasonId}
                href={
                  ls.seasonId === currentSeasonId
                    ? `/leagues/${leagueId}/league`
                    : `/leagues/${leagueId}/league?season=${ls.season.year}`
                }
                className={`${styles.yearTab} ${ls.seasonId === viewingSeasonRow?.seasonId ? styles.yearTabActive : ""}`}
              >
                {ls.season.year}
              </Link>
            ))}
          </div>
        )}
        <p className={styles.sub}>
          Every player&apos;s score, every week, {isViewingCurrent ? "this season" : viewingSeasonRow?.season.year} —
          click a race to see the breakdown.
        </p>
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

      {rules.length > 0 && (
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
      )}
    </>
  );
}
