import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import Card from "@/components/ui/Card";
import { getLeagueHubData } from "../leagueData";

export const dynamic = "force-dynamic";

export default async function PastScoresPage(props: { params: Promise<{ leagueId: string }> }) {
  const { leagueId } = await props.params;

  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const data = await getLeagueHubData(leagueId, session.user.id);
  if (!data) {
    notFound();
  }

  const { races, members, picks } = data;

  // race -> user -> total score that week
  const scoreByRaceUser = new Map<string, Map<string, number>>();
  for (const p of picks) {
    if (!p.score) continue;
    const byUser = scoreByRaceUser.get(p.raceId) ?? new Map<string, number>();
    byUser.set(p.userId, (byUser.get(p.userId) ?? 0) + p.score.total);
    scoreByRaceUser.set(p.raceId, byUser);
  }
  const scoredRaces = races.filter((r) => scoreByRaceUser.has(r.id));

  return (
    <Card title="Past Scores">
      {scoredRaces.length === 0 ? (
        <p>No races have been scored yet this season.</p>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table>
            <thead>
              <tr>
                <th>Week</th>
                {members.map((m) => (
                  <th key={m.userId}>{m.user.name ?? m.user.email}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {scoredRaces.map((r) => {
                const byUser = scoreByRaceUser.get(r.id)!;
                return (
                  <tr key={r.id}>
                    <td>
                      Wk {r.week} — {r.trackName}
                    </td>
                    {members.map((m) => (
                      <td key={m.userId}>{byUser.get(m.userId) ?? "—"}</td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
