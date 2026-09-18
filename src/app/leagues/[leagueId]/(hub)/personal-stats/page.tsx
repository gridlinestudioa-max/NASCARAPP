import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import Card from "@/components/ui/Card";
import { getLeagueHubData } from "../leagueData";

export const dynamic = "force-dynamic";

export default async function PersonalStatsPage(props: { params: Promise<{ leagueId: string }> }) {
  const { leagueId } = await props.params;

  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const data = await getLeagueHubData(leagueId, session.user.id);
  if (!data) {
    notFound();
  }

  const { league, races, picks } = data;
  const userId = session.user.id;
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
      <Card title="Personal Stats">
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
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              {weeks.map((w) => (
                <tr key={w.week}>
                  <td>{w.week}</td>
                  <td>{w.trackName}</td>
                  <td>{w.total}</td>
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
    <Card title="Personal Stats">
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
              <th>Finish</th>
              <th>Score</th>
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
                  <td>{p.score?.finishPosition ?? "—"}</td>
                  <td>{p.score?.total ?? "—"}</td>
                </tr>
              ))}
          </tbody>
        </table>
      )}
    </Card>
  );
}
