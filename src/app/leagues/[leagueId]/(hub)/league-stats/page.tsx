import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import Card from "@/components/ui/Card";
import { computeWeeklyTotals, scoredRacesInOrder, computePlayerSeasonStats } from "@/lib/leagueStats";
import { getLeagueHubData } from "../leagueData";

export const dynamic = "force-dynamic";

export default async function LeagueStatsPage(props: { params: Promise<{ leagueId: string }> }) {
  const { leagueId } = await props.params;

  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const data = await getLeagueHubData(leagueId, session.user.id);
  if (!data) {
    notFound();
  }

  const { picks, races, members } = data;
  const raceByWeek = new Map(races.map((r) => [r.id, r]));

  const scored = picks.filter((p) => p.score);
  const totalPoints = scored.reduce((sum, p) => sum + (p.score?.total ?? 0), 0);
  const avg = scored.length > 0 ? totalPoints / scored.length : 0;

  const driverCounts = new Map<string, number>();
  for (const p of picks) {
    driverCounts.set(p.driver.name, (driverCounts.get(p.driver.name) ?? 0) + 1);
  }
  const mostPicked = [...driverCounts.entries()].sort((a, b) => b[1] - a[1])[0];

  const best = scored.slice().sort((a, b) => (b.score?.total ?? 0) - (a.score?.total ?? 0))[0];

  const weekly = computeWeeklyTotals(races, picks);
  const scoredRaces = scoredRacesInOrder(races, weekly);
  const playerStats = computePlayerSeasonStats(members, scoredRaces, weekly, picks);
  const consistencySorted = playerStats.slice().sort((a, b) => b.consistencyScore - a.consistencyScore);
  const stageSorted = playerStats.slice().sort((a, b) => b.total - a.total);

  return (
    <>
      <Card title="League Stats">
        {scored.length === 0 ? (
          <p>No scored picks yet this season.</p>
        ) : (
          <ul className="rowList">
            <li>
              <span>Total picks scored</span>
              <strong>{scored.length}</strong>
            </li>
            <li>
              <span>Average score per pick</span>
              <strong>{avg.toFixed(1)}</strong>
            </li>
            {mostPicked && (
              <li>
                <span>Most-picked driver</span>
                <strong>
                  {mostPicked[0]} ({mostPicked[1]}x)
                </strong>
              </li>
            )}
            {best && (
              <li>
                <span>
                  Best single score — {best.user.name ?? best.user.email} with {best.driver.name}, Week{" "}
                  {raceByWeek.get(best.raceId)?.week ?? "—"}
                </span>
                <strong>{best.score?.total}</strong>
              </li>
            )}
          </ul>
        )}
      </Card>

      <Card title="Consistency">
        {consistencySorted.length === 0 || scoredRaces.length === 0 ? (
          <p>No scored races yet this season.</p>
        ) : (
          <>
            <p style={{ marginBottom: "var(--space-3)" }}>
              Season average points per race, divided by standard deviation — higher means steadier output
              relative to their own average.
            </p>
            <table>
              <thead>
                <tr>
                  <th>Player</th>
                  <th>Avg pts</th>
                  <th>Std dev</th>
                  <th>Score</th>
                </tr>
              </thead>
              <tbody>
                {consistencySorted.map((p) => (
                  <tr key={p.userId}>
                    <td>{p.name}</td>
                    <td>{p.avg.toFixed(2)}</td>
                    <td>{p.stdDev.toFixed(2)}</td>
                    <td>{p.consistencyScore.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </Card>

      <Card title="Stage Points">
        {stageSorted.length === 0 ? (
          <p>No scored picks yet this season.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Player</th>
                <th>Total</th>
                <th>Stage</th>
                <th>Stage %</th>
              </tr>
            </thead>
            <tbody>
              {stageSorted.map((p) => (
                <tr key={p.userId}>
                  <td>{p.name}</td>
                  <td>{p.total}</td>
                  <td>{p.stagePts}</td>
                  <td>{p.stagePct.toFixed(1)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </>
  );
}
