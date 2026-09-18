import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import { getLeagueHubData } from "./leagueData";

export const dynamic = "force-dynamic";

export default async function LeagueStandingsPage(props: { params: Promise<{ leagueId: string }> }) {
  const { leagueId } = await props.params;

  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const data = await getLeagueHubData(leagueId, session.user.id);
  if (!data) {
    notFound();
  }

  const { league, standings, races } = data;

  return (
    <>
      <Card title="Standings">
        <table>
          <thead>
            <tr>
              <th>Rank</th>
              <th>Player</th>
              <th>Total</th>
              <th>Races picked</th>
              <th>Flagged</th>
            </tr>
          </thead>
          <tbody>
            {standings.map((s, i) => (
              <tr key={s.userId} style={s.userId === session.user.id ? { fontWeight: 700 } : undefined}>
                <td>{i + 1}</td>
                <td>{s.name}</td>
                <td>{s.total}</td>
                <td>{s.picksCount}</td>
                <td>{s.needsReviewCount > 0 ? <Badge tone="warning">{s.needsReviewCount}</Badge> : ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      {races.length > 0 && (
        <Card title="Races">
          <ul className="rowList">
            {races.map((r) => (
              <li key={r.id}>
                <Link href={`/leagues/${league.id}/races/${r.id}`}>
                  Week {r.week} — {r.trackName}
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </>
  );
}
