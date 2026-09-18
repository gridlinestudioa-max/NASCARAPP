import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import Card from "@/components/ui/Card";
import { getLeagueHubData } from "../leagueData";
import styles from "./RaceBreakdown.module.css";

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
  const nameByUserId = new Map(members.map((m) => [m.userId, m.user.name ?? m.user.email]));

  // race -> user -> total score that week
  const scoreByRaceUser = new Map<string, Map<string, number>>();
  for (const p of picks) {
    if (!p.score) continue;
    const byUser = scoreByRaceUser.get(p.raceId) ?? new Map<string, number>();
    byUser.set(p.userId, (byUser.get(p.userId) ?? 0) + p.score.total);
    scoreByRaceUser.set(p.raceId, byUser);
  }
  const scoredRaces = races.filter((r) => scoreByRaceUser.has(r.id));

  // race -> every scored pick that race, sorted by points descending
  const picksByRace = new Map<string, typeof picks>();
  for (const p of picks) {
    if (!p.score) continue;
    const list = picksByRace.get(p.raceId) ?? [];
    list.push(p);
    picksByRace.set(p.raceId, list);
  }
  const mostRecentFirst = scoredRaces.slice().sort((a, b) => b.week - a.week);

  return (
    <>
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

      {mostRecentFirst.length > 0 && (
        <Card title="Race-by-Race Breakdown">
          <div className={styles.raceList}>
            {mostRecentFirst.map((r) => {
              const rows = (picksByRace.get(r.id) ?? []).slice().sort((a, b) => (b.score?.total ?? 0) - (a.score?.total ?? 0));
              return (
                <details key={r.id} className={styles.raceItem}>
                  <summary className={styles.summary}>
                    <div>
                      <div className={styles.trackName}>{r.trackName}</div>
                      <div className={styles.raceNum}>Week {r.week}</div>
                    </div>
                    <svg
                      className={styles.chev}
                      width="18"
                      height="18"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      aria-hidden="true"
                    >
                      <path d="M9 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </summary>
                  <table>
                    <thead>
                      <tr>
                        <th>Player</th>
                        <th>Driver</th>
                        <th>Points</th>
                        <th>Stage</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((p) => (
                        <tr key={p.id}>
                          <td>{nameByUserId.get(p.userId) ?? "—"}</td>
                          <td>{p.driver.name}</td>
                          <td>{p.score?.total}</td>
                          <td>{(p.score?.stageBonus ?? 0) > 0 ? `+${p.score?.stageBonus}` : "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </details>
              );
            })}
          </div>
        </Card>
      )}
    </>
  );
}
