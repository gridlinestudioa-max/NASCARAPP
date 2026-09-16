import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function RaceDetailPage(
  props: PageProps<"/leagues/[leagueId]/races/[raceId]">,
) {
  const { leagueId, raceId } = await props.params;

  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const membership = await prisma.leagueMembership.findUnique({
    where: { leagueId_userId: { leagueId, userId: session.user.id } },
  });
  if (!membership) {
    notFound();
  }

  const race = await prisma.race.findUnique({
    where: { id: raceId },
    include: { season: true },
  });
  // Scope to this league: a race id that's real but belongs to a
  // different league's season shouldn't be reachable through this URL.
  if (!race || race.season.leagueId !== leagueId) {
    notFound();
  }

  const picks = await prisma.pick.findMany({
    where: { leagueId, raceId },
    include: { user: true, driver: true, score: true },
    orderBy: { score: { total: "desc" } },
  });

  return (
    <main>
      <p>
        <Link href={`/leagues/${leagueId}`}>&larr; Standings</Link>
      </p>
      <h1>
        Week {race.week} — {race.trackName}
      </h1>
      <p>
        Field size {race.fieldSize}
        {race.isNonPoints && " · non-points event"}
      </p>

      <table>
        <thead>
          <tr>
            <th>Player</th>
            <th>Driver</th>
            <th>Finish</th>
            <th>Base</th>
            <th>Win bonus</th>
            <th>Stage bonus</th>
            <th>Total</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {picks.map((p) => (
            <tr
              key={p.id}
              style={p.userId === session.user.id ? { fontWeight: "bold" } : undefined}
            >
              <td>{p.user.name ?? p.user.email}</td>
              <td>{p.driver.name}</td>
              <td>{p.score?.finishPosition ?? "—"}</td>
              <td>{p.score?.baseScore ?? "—"}</td>
              <td>{p.score?.winBonus ?? "—"}</td>
              <td>{p.score?.stageBonus ?? "—"}</td>
              <td>{p.score?.total ?? "—"}</td>
              <td>{p.score?.needsReview ? "flagged" : ""}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}
