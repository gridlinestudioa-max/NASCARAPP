import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import Breadcrumb from "@/components/ui/Breadcrumb";
import { computeSeasonPointsStandings } from "@/lib/seasonPoints";

export const dynamic = "force-dynamic";

export default async function StatsPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const season = await prisma.season.findFirst({ orderBy: { year: "desc" } });
  const pointsStandings = season ? await computeSeasonPointsStandings(season.id) : [];

  return (
    <main>
      <Breadcrumb items={[{ label: "Dashboards" }, { label: "Driver Stats" }]} />
      <h1>Driver Stats</h1>
      {season && <p>{season.year} season</p>}

      <p>
        <small>
          Computed from our own synced results using the 2026 Cup points system — NASCAR doesn&apos;t expose a
          persistent standings feed we can pull from, only a live leaderboard that only exists while a race is
          actually green-flag live. Finish points (55 for a win, then 37 minus position, floor of 1) plus stage
          points, first 26 races. After that, the top 16 get reset to their Chase seed and the last 10 races add on
          top of that — everyone else keeps accumulating normally.
        </small>
      </p>
      <Card>
        {pointsStandings.length === 0 ? (
          <p>No results have been entered yet.</p>
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
              {pointsStandings.map((e, i) => (
                <tr key={e.driverId}>
                  <td>{i + 1}</td>
                  <td>
                    {e.driverName} {e.inChase && <Badge tone="success">Chase</Badge>}
                  </td>
                  <td>{e.points}</td>
                  <td>{e.wins}</td>
                  <td>{e.top5}</td>
                  <td>{e.top10}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </main>
  );
}
