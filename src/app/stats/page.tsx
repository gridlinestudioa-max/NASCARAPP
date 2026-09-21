import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import Card from "@/components/ui/Card";
import { fetchLivePoints, type NascarPointsEntry } from "@/lib/nascarFeed";

export const dynamic = "force-dynamic";

async function getPointsStandings(seasonId: string): Promise<
  { ok: true; entries: NascarPointsEntry[] } | { ok: false; error: string }
> {
  // Any race in the season NASCAR's schedule has already been matched to
  // (nascarRaceId set) works as the anchor — the feed returns the current
  // season standings regardless of which race id it's requested under, so
  // this doesn't need to be "the next race" the way the auto-tier formula's
  // per-race call does.
  const anchorRace = await prisma.race.findFirst({
    where: { seasonId, nascarRaceId: { not: null } },
    orderBy: { date: "desc" },
  });
  if (!anchorRace || !anchorRace.nascarRaceId) {
    return { ok: false, error: "No race is linked to NASCAR's schedule yet." };
  }
  try {
    const entries = await fetchLivePoints(anchorRace.nascarSeriesId, anchorRace.nascarRaceId);
    return { ok: true, entries: [...entries].sort((a, b) => a.points_position - b.points_position) };
  } catch (cause) {
    return { ok: false, error: `Couldn't reach NASCAR's points feed: ${(cause as Error).message}` };
  }
}

type DriverStats = {
  driverId: string;
  name: string;
  races: number;
  wins: number;
  top5: number;
  top10: number;
  totalFinish: number;
};

export default async function StatsPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const season = await prisma.season.findFirst({ orderBy: { year: "desc" } });
  // Only covers drivers picked in at least one league (see /races/[raceId]/results)
  // — not the full field for races where nobody picked a given driver.
  const results = season
    ? await prisma.raceResult.findMany({
        where: { race: { seasonId: season.id } },
        include: { driver: true },
      })
    : [];
  const pointsStandings = season ? await getPointsStandings(season.id) : null;

  const statsByDriverId = new Map<string, DriverStats>();
  for (const r of results) {
    const existing = statsByDriverId.get(r.driverId) ?? {
      driverId: r.driverId,
      name: r.driver.name,
      races: 0,
      wins: 0,
      top5: 0,
      top10: 0,
      totalFinish: 0,
    };
    existing.races += 1;
    if (r.finishingPosition === 1) existing.wins += 1;
    if (r.finishingPosition <= 5) existing.top5 += 1;
    if (r.finishingPosition <= 10) existing.top10 += 1;
    existing.totalFinish += r.finishingPosition;
    statsByDriverId.set(r.driverId, existing);
  }

  const stats = [...statsByDriverId.values()].sort((a, b) => b.wins - a.wins || a.totalFinish / a.races - b.totalFinish / b.races);

  return (
    <main>
      <h1>Driver Stats</h1>
      {season && <p>{season.year} season</p>}

      <h2>NASCAR points standings</h2>
      <Card>
        {!pointsStandings ? (
          <p>No season set up yet.</p>
        ) : !pointsStandings.ok ? (
          <p>{pointsStandings.error}</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Rank</th>
                <th>Driver</th>
                <th>Points</th>
                <th>Wins</th>
                <th>Top 5</th>
                <th>Top 10</th>
              </tr>
            </thead>
            <tbody>
              {pointsStandings.entries.map((e) => (
                <tr key={e.driver_id}>
                  <td>{e.points_position}</td>
                  <td>
                    {e.first_name} {e.last_name}
                  </td>
                  <td>{e.points}</td>
                  <td>{e.wins}</td>
                  <td>{e.top_5}</td>
                  <td>{e.top_10}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <h2>Stats from your leagues&apos; picks</h2>
      <Card>
        {stats.length === 0 ? (
          <p>No results have been entered yet.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Driver</th>
                <th>Races</th>
                <th>Wins</th>
                <th>Top 5</th>
                <th>Top 10</th>
                <th>Avg finish</th>
              </tr>
            </thead>
            <tbody>
              {stats.map((s) => (
                <tr key={s.driverId}>
                  <td>{s.name}</td>
                  <td>{s.races}</td>
                  <td>{s.wins}</td>
                  <td>{s.top5}</td>
                  <td>{s.top10}</td>
                  <td>{(s.totalFinish / s.races).toFixed(1)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </main>
  );
}
