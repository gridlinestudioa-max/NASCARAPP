import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

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
      <p>
        <Link href="/my-leagues">&larr; My Leagues</Link>
      </p>
      <h1>Driver Stats</h1>
      {season && <p>{season.year} season</p>}

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
    </main>
  );
}
