import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import UserAvatar from "@/components/ui/UserAvatar";
import { computeWeeklyTotals, scoredRacesInOrder, computePlayerSeasonStats } from "@/lib/leagueStats";
import { getLeagueHubData } from "../leagueData";

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

  const { standings, races, members, picks } = data;

  const avatarByUserId = new Map(members.map((m) => [m.userId, m.user.avatarUrl]));

  const weekly = computeWeeklyTotals(races, picks);
  const scoredRaces = scoredRacesInOrder(races, weekly);
  const playerStats = computePlayerSeasonStats(members, scoredRaces, weekly, picks);
  const statsByUserId = new Map(playerStats.map((p) => [p.userId, p]));
  const momentumSorted = playerStats
    .filter((p) => p.momentum != null)
    .sort((a, b) => (b.momentum ?? 0) - (a.momentum ?? 0));

  return (
    <>
      <Card title="Standings">
        <table>
          <thead>
            <tr>
              <th>Rank</th>
              <th>Player</th>
              <th>Total</th>
              <th>Diff to leader</th>
              <th>Last race</th>
              <th>Flagged</th>
            </tr>
          </thead>
          <tbody>
            {standings.map((s, i) => {
              const stats = statsByUserId.get(s.userId);
              return (
                <tr key={s.userId} style={s.userId === session.user.id ? { fontWeight: 700 } : undefined}>
                  <td>{i + 1}</td>
                  <td>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: "8px" }}>
                      <UserAvatar name={s.name} avatarUrl={avatarByUserId.get(s.userId)} />
                      {s.name}
                    </span>
                  </td>
                  <td style={{ fontWeight: 800, fontFamily: "var(--font-heading)", color: "var(--accent)" }}>
                    {s.total}
                  </td>
                  <td>{!stats || stats.diffToLeader === 0 ? "Leader" : `+${stats.diffToLeader}`}</td>
                  <td>{stats?.lastRacePts != null ? `+${stats.lastRacePts}` : "—"}</td>
                  <td>{s.needsReviewCount > 0 ? <Badge tone="warning">{s.needsReviewCount}</Badge> : ""}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>

      {momentumSorted.length > 0 && (
        <Card title="Momentum">
          <p style={{ marginBottom: "var(--space-3)" }}>
            How each player&apos;s most recent race compared to the one before it.
          </p>
          <table>
            <thead>
              <tr>
                <th>Player</th>
                <th>Momentum</th>
              </tr>
            </thead>
            <tbody>
              {momentumSorted.map((p) => (
                <tr key={p.userId}>
                  <td>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: "8px" }}>
                      <UserAvatar name={p.name} avatarUrl={avatarByUserId.get(p.userId)} />
                      {p.name}
                    </span>
                  </td>
                  <td>
                    <Badge tone={(p.momentum ?? 0) >= 0 ? "success" : "danger"}>
                      {(p.momentum ?? 0) >= 0 ? "+" : ""}
                      {p.momentum}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </>
  );
}
