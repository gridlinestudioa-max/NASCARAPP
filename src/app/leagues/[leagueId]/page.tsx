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
  if (!session?.user) {
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
    </main>
  );
}
