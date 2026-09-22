import Link from "next/link";
import { redirect } from "next/navigation";
import type { Prisma } from "@prisma/client";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import StatCard from "@/components/dashboard/StatCard";
import SeasonScoreTrend from "@/components/dashboard/SeasonScoreTrend";
import PointsDonut, { type DonutSlice } from "@/components/dashboard/PointsDonut";
import { getLeagueHubData } from "@/app/leagues/[leagueId]/(hub)/leagueData";
import { computeSeasonPointsStandings } from "@/lib/seasonPoints";
import { computePlayerSeasonStats, computeTrendSeries, computeWeeklyTotals, ordinal, scoredRacesInOrder } from "@/lib/leagueStats";
import styles from "./page.module.css";

export const dynamic = "force-dynamic";

function countdownLabel(date: Date): string {
  const diffMs = Math.max(date.getTime() - Date.now(), 0);
  const days = Math.floor(diffMs / 86_400_000);
  if (days > 0) return `${days}d`;
  const hours = Math.floor((diffMs % 86_400_000) / 3_600_000);
  return `${hours}h`;
}

export default async function Home() {
  const session = await auth();
  // Also guards against a stale session predating a session-shape change
  // (e.g. before user.id was added to the token) — without this, a
  // missing id would silently drop the where-filter below instead of
  // matching nothing.
  if (!session?.user?.id) {
    redirect("/login");
  }
  const userId = session.user.id;
  const displayName = session.user.name ?? session.user.email ?? "there";
  const firstName = displayName.split(" ")[0];

  const [memberships, season] = await Promise.all([
    prisma.leagueMembership.findMany({
      where: { userId },
      include: { league: true },
      orderBy: { league: { name: "asc" } },
    }),
    prisma.season.findFirst({ orderBy: { year: "desc" } }),
  ]);

  const [upcomingRaces, pointsStandings] = await Promise.all([
    season
      ? prisma.race.findMany({
          where: { seasonId: season.id, date: { gte: new Date() } },
          orderBy: { date: "asc" },
          take: 4,
        })
      : Promise.resolve([]),
    season ? computeSeasonPointsStandings(season.id) : Promise.resolve([]),
  ]);

  return (
    <main>
      {memberships.length === 0 ? (
        <>
          <h1>Welcome, {firstName}</h1>
          <Card
            title="Your Leagues"
            actions={
              <>
                <Link href="/leagues/new" className="linkButton">
                  Create a league
                </Link>
                <Link href="/leagues/join" className="linkButtonOutline">
                  Join with code
                </Link>
              </>
            }
          >
            <p>You&apos;re not in any leagues yet.</p>
          </Card>
        </>
      ) : (
        <HomeDashboard userId={userId} firstName={firstName} memberships={memberships} />
      )}

      <div className={styles.snapshotRow}>
        <ScheduleSnapshot races={upcomingRaces} />
        <DriverPointsSnapshot standings={pointsStandings.slice(0, 5)} />
      </div>
    </main>
  );
}

function ScheduleSnapshot({
  races,
}: {
  races: { id: string; week: number; trackName: string; venueName: string | null; date: Date }[];
}) {
  return (
    <Card title="Upcoming Schedule" actions={<Link href="/races">See all →</Link>}>
      {races.length === 0 ? (
        <p className={styles.empty}>No upcoming races scheduled.</p>
      ) : (
        <ul className="rowList">
          {races.map((r) => (
            <li key={r.id}>
              <span>
                Wk {r.week} — {r.trackName}
              </span>
              <span className={styles.muted}>
                {r.date.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function DriverPointsSnapshot({
  standings,
}: {
  standings: { driverId: string; driverName: string; points: number }[];
}) {
  return (
    <Card title="Driver Points" actions={<Link href="/stats">See all →</Link>}>
      {standings.length === 0 ? (
        <p className={styles.empty}>No results scored yet this season.</p>
      ) : (
        <ul className="rowList">
          {standings.map((s, i) => (
            <li key={s.driverId}>
              <span>
                {i + 1}. {s.driverName}
              </span>
              <span className={styles.muted}>{s.points.toLocaleString()} pts</span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

type MembershipWithLeague = Prisma.LeagueMembershipGetPayload<{ include: { league: true } }>;

async function HomeDashboard({
  userId,
  firstName,
  memberships,
}: {
  userId: string;
  firstName: string;
  memberships: MembershipWithLeague[];
}) {
  const hubDataList = await Promise.all(memberships.map((m) => getLeagueHubData(m.leagueId, userId)));

  const leagueRows = memberships.map((m, i) => {
    const hub = hubDataList[i];
    if (!hub) {
      return {
        id: m.leagueId,
        name: m.league.name,
        iconUrl: m.league.iconUrl,
        isCommissioner: m.role === "OWNER",
        memberCount: 0,
        score: 0,
        rank: null as number | null,
        lockedDrivers: [] as string[],
      };
    }
    const weekly = computeWeeklyTotals(hub.races, hub.picks);
    const scoredRaces = scoredRacesInOrder(hub.races, weekly);
    const stats = computePlayerSeasonStats(hub.members, scoredRaces, weekly, hub.picks);
    const mine = stats.find((s) => s.userId === userId);
    const nextRace = hub.nextOpenRace;
    const lockedDrivers = nextRace
      ? [...new Set(hub.picks.filter((p) => p.raceId === nextRace.id).map((p) => p.driver.name))].slice(0, 3)
      : [];
    return {
      id: m.leagueId,
      name: m.league.name,
      iconUrl: m.league.iconUrl,
      isCommissioner: m.role === "OWNER",
      memberCount: hub.members.length,
      score: mine?.total ?? 0,
      rank: mine?.rank ?? null,
      lockedDrivers,
    };
  });

  // The "primary" league driving the welcome header, stat cards, trend
  // chart and points breakdown is simply the first league alphabetically —
  // same deterministic ordering as the table below.
  const primary = memberships[0];
  const primaryHub = hubDataList[0];

  const commissionerCount = memberships.filter((m) => m.role === "OWNER").length;
  const bestRow = leagueRows.reduce<(typeof leagueRows)[number] | null>((best, row) => {
    if (row.rank == null) return best;
    if (!best || best.rank == null || row.rank < best.rank) return row;
    return best;
  }, null);

  let myTrend: number[] = [];
  let avgTrend: number[] = [];
  let raceLabels: string[] = [];
  let seasonScore = 0;
  let momentumLabel = "No races scored yet";
  const donutSlices: DonutSlice[] = [];
  let nextRace: { trackName: string; venueName: string | null; date: Date } | null = null;

  if (primaryHub) {
    const weekly = computeWeeklyTotals(primaryHub.races, primaryHub.picks);
    const scoredRaces = scoredRacesInOrder(primaryHub.races, weekly);
    const stats = computePlayerSeasonStats(primaryHub.members, scoredRaces, weekly, primaryHub.picks);
    const mine = stats.find((s) => s.userId === userId);
    seasonScore = mine?.total ?? 0;
    if (mine?.momentum != null) {
      momentumLabel = `${mine.momentum >= 0 ? "+" : ""}${mine.momentum} last race`;
    } else if (mine?.lastRacePts != null) {
      momentumLabel = `${mine.lastRacePts} last race`;
    }

    const trend = computeTrendSeries(primaryHub.members, scoredRaces, weekly);
    myTrend = trend.totals.find((t) => t.userId === userId)?.data ?? [];
    avgTrend = scoredRaces.map((_, i) => {
      const vals = trend.totals.map((t) => t.data[i] ?? 0);
      return vals.length > 0 ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
    });
    raceLabels = trend.labels;

    const myPicks = primaryHub.picks.filter((p) => p.userId === userId && p.score);
    const raceFinish = myPicks.reduce((sum, p) => sum + (p.score?.baseScore ?? 0), 0);
    const stagePoints = myPicks.reduce((sum, p) => sum + (p.score?.stageBonus ?? 0), 0);
    const bonus = myPicks.reduce((sum, p) => sum + (p.score?.winBonus ?? 0) + (p.score?.qualifyingBonus ?? 0), 0);
    const breakdownTotal = raceFinish + stagePoints + bonus;
    if (breakdownTotal > 0) {
      donutSlices.push(
        { name: "Race Finish", pct: Math.round((raceFinish / breakdownTotal) * 100), color: "var(--ink)" },
        { name: "Stage Points", pct: Math.round((stagePoints / breakdownTotal) * 100), color: "var(--muted)" },
        { name: "Bonus Picks", pct: Math.max(0, 100 - Math.round((raceFinish / breakdownTotal) * 100) - Math.round((stagePoints / breakdownTotal) * 100)), color: "#dcdad0" },
      );
    }

    nextRace = primaryHub.nextOpenRace;
  }

  return (
    <>
      <div className={styles.header}>
        <div>
          <h1>Welcome back, {firstName}</h1>
          <p className={styles.headerSub}>
            {nextRace
              ? `${nextRace.trackName} · ${nextRace.date.toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" })}`
              : "No upcoming races scheduled."}
          </p>
        </div>
        {nextRace && primaryHub && (
          <Link href={`/leagues/${primary.leagueId}/races/${primaryHub.nextOpenRace!.id}`} className="linkButton">
            Set Lineup
          </Link>
        )}
      </div>

      <div className={styles.statGrid}>
        <StatCard label="Season Score" value={seasonScore.toLocaleString()} delta={momentumLabel} />
        <StatCard
          label="Overall Rank"
          value={bestRow?.rank ? ordinal(bestRow.rank) : "—"}
          delta={bestRow ? `Best in ${bestRow.name}` : "No scored races yet"}
        />
        <StatCard
          label="Active Leagues"
          value={String(memberships.length)}
          delta={commissionerCount > 0 ? `${commissionerCount} as commissioner` : "0 as commissioner"}
        />
        <StatCard
          label="Next Race Locks"
          value={nextRace ? countdownLabel(nextRace.date) : "—"}
          delta={nextRace?.trackName ?? "No race scheduled"}
        />
      </div>

      <div className={styles.chartRow}>
        <Card className={styles.trendCard}>
          <div className={styles.trendHeader}>
            <span className={styles.trendTitle}>Season Score Trend</span>
            <span className={styles.trendLegend}>
              <span className={styles.legendItem}>
                <span className={`${styles.legendDot} ${styles.legendDotInk}`} /> Your score
              </span>
              <span className={styles.legendItem}>
                <span className={`${styles.legendDot} ${styles.legendDotFaint}`} /> League avg
              </span>
            </span>
          </div>
          <div className={styles.trendScore}>{seasonScore.toLocaleString()} pts</div>
          <SeasonScoreTrend labels={raceLabels} mine={myTrend} average={avgTrend} />
        </Card>

        <Card className={styles.donutCard}>
          <div className={styles.trendTitle}>Points Breakdown</div>
          <div className={styles.donutSub}>By scoring category</div>
          {donutSlices.length > 0 ? (
            <PointsDonut slices={donutSlices} centerValue={seasonScore.toLocaleString()} centerLabel="total pts" />
          ) : (
            <p className={styles.empty}>No scored picks yet this season.</p>
          )}
        </Card>
      </div>

      <Card
        title="Your Leagues"
        actions={
          <>
            <Link href="/leagues/new" className="linkButton">
              Create a league
            </Link>
            <Link href="/leagues/join" className="linkButtonOutline">
              Join with code
            </Link>
          </>
        }
      >
        <div className={styles.tableHead}>
          <span>League</span>
          <span>Members</span>
          <span>Score</span>
          <span>Rank</span>
          <span>Locked</span>
        </div>
        {leagueRows.map((row) => (
          <Link key={row.id} href={`/leagues/${row.id}`} className={styles.tableRow}>
            <span className={styles.leagueCell}>
              {row.iconUrl ? (
                // eslint-disable-next-line @next/next/no-img-element -- arbitrary commissioner-pasted URL, not a static/local asset
                <img src={row.iconUrl} alt="" className={styles.avatarImg} />
              ) : (
                <span className={styles.avatar}>{row.name.charAt(0).toUpperCase()}</span>
              )}
              <span className={styles.leagueCellText}>
                <span className={styles.leagueName}>{row.name}</span>
                {row.isCommissioner && <Badge tone="neutral">Commish</Badge>}
              </span>
            </span>
            <span className={styles.muted}>{row.memberCount}</span>
            <span className={styles.scoreCell}>{row.score.toLocaleString()}</span>
            <span className={styles.muted}>{row.rank ? ordinal(row.rank) : "—"}</span>
            <span className={styles.lockedCell}>
              {row.lockedDrivers.length === 0 ? (
                <span className={styles.muted}>—</span>
              ) : (
                row.lockedDrivers.map((name) => <span key={name} className={styles.lockChip} title={name} />)
              )}
            </span>
          </Link>
        ))}
      </Card>
    </>
  );
}
