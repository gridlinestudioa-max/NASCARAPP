import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type Standing = {
  userId: string;
  name: string;
  total: number;
  picksCount: number;
  needsReviewCount: number;
};

export default async function LeagueDashboardPage(props: PageProps<"/leagues/[leagueId]">) {
  const { leagueId } = await props.params;

  const session = await auth();
  // Also guards against a stale session predating a session-shape change
  // (e.g. before user.id was added to the token) — findUnique's compound
  // key throws on a missing id rather than matching nothing.
  if (!session?.user?.id) {
    redirect("/login");
  }

  const membership = await prisma.leagueMembership.findUnique({
    where: { leagueId_userId: { leagueId, userId: session.user.id } },
  });
  if (!membership) {
    // Not a member — hide the league's existence rather than exposing a
    // "you're not allowed" distinction.
    notFound();
  }

  const league = await prisma.league.findUnique({
    where: { id: leagueId },
    include: {
      seasons: { orderBy: { year: "desc" }, take: 1 },
    },
  });
  if (!league) {
    notFound();
  }

  const picks = await prisma.pick.findMany({
    where: { leagueId },
    include: { user: true, score: true },
  });

  const standingsByUser = new Map<string, Standing>();
  for (const pick of picks) {
    const existing = standingsByUser.get(pick.userId) ?? {
      userId: pick.userId,
      name: pick.user.name ?? pick.user.email,
      total: 0,
      picksCount: 0,
      needsReviewCount: 0,
    };
    existing.total += pick.score?.total ?? 0;
    existing.picksCount += 1;
    if (pick.score?.needsReview) {
      existing.needsReviewCount += 1;
    }
    standingsByUser.set(pick.userId, existing);
  }

  const standings = [...standingsByUser.values()].sort((a, b) => b.total - a.total);
  const season = league.seasons[0];

  const races = season
    ? await prisma.race.findMany({
        where: { seasonId: season.id },
        orderBy: { week: "asc" },
      })
    : [];

  return (
    <main>
      <p>
        <Link href="/my-leagues">&larr; My Leagues</Link>
      </p>
      <h1>{league.name}</h1>
      {season && <p>{season.year} season</p>}

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
            <tr key={s.userId} style={s.userId === session.user.id ? { fontWeight: "bold" } : undefined}>
              <td>{i + 1}</td>
              <td>{s.name}</td>
              <td>{s.total}</td>
              <td>{s.picksCount}</td>
              <td>{s.needsReviewCount > 0 ? s.needsReviewCount : ""}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {races.length > 0 && (
        <>
          <h2>Races</h2>
          <ul>
            {races.map((r) => (
              <li key={r.id}>
                <Link href={`/leagues/${league.id}/races/${r.id}`}>
                  Week {r.week} — {r.trackName}
                </Link>
                {r.isNonPoints && " (non-points)"}
              </li>
            ))}
          </ul>
        </>
      )}
    </main>
  );
}
