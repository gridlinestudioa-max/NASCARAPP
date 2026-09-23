import Link from "next/link";
import { redirect } from "next/navigation";
import type { Prisma } from "@prisma/client";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import { getLeagueHubData } from "@/app/leagues/[leagueId]/(hub)/leagueData";
import { computeSeasonPointsStandings } from "@/lib/seasonPoints";
import { computePlayerSeasonStats, computeWeeklyTotals, ordinal, scoredRacesInOrder } from "@/lib/leagueStats";
import { displayRaceName } from "@/lib/raceName";
import styles from "./page.module.css";

export const dynamic = "force-dynamic";

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
              <span className={styles.scheduleRace}>
                <span className={styles.weekChip}>{r.week}</span>
                {displayRaceName(r.trackName)}
              </span>
              <span className={styles.muted}>
                {r.date.toLocaleDateString(undefined, { month: "short", day: "numeric" })}
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
        nextRaceId: null as string | null,
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
      nextRaceId: nextRace?.id ?? null,
    };
  });

  return (
    <>
      <div className={styles.header}>
        <div>
          <h1>Welcome back, {firstName}</h1>
          <p className={styles.headerSub}>Here&apos;s where things stand across your leagues.</p>
        </div>
      </div>

      <Card
        title="My Leagues"
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
          <span />
        </div>
        {leagueRows.map((row) => (
          <div key={row.id} className={styles.tableRow}>
            <Link href={`/leagues/${row.id}`} className={styles.leagueCell}>
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
            </Link>
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
            <span className={styles.actionCell}>
              {row.nextRaceId ? (
                <Link href={`/leagues/${row.id}/races/${row.nextRaceId}`} className="linkButton">
                  Set Lineup
                </Link>
              ) : (
                <Link href={`/leagues/${row.id}`} className="linkButtonOutline">
                  View league
                </Link>
              )}
            </span>
          </div>
        ))}
      </Card>
    </>
  );
}
