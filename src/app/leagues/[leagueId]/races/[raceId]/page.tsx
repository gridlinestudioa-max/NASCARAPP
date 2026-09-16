import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import PickForm from "./PickForm";

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

  // Picks are open (and other players' driver choices stay hidden) until
  // either results come in or the race has already happened — whichever
  // comes first. Once locked, everyone's picks become visible.
  const hasResults = picks.some((p) => p.score);
  // eslint-disable-next-line react-hooks/purity -- this route is force-dynamic (never prerendered), so wall-clock time here is safe
  const now = Date.now();
  const isOpenForPicks = !hasResults && race.date.getTime() > now;

  if (isOpenForPicks) {
    const [members, drivers] = await Promise.all([
      prisma.leagueMembership.findMany({ where: { leagueId }, include: { user: true } }),
      prisma.driver.findMany({ where: { isActive: true }, orderBy: { name: "asc" } }),
    ]);
    const myPick = picks.find((p) => p.userId === session.user!.id) ?? null;
    const pickedUserIds = new Set(picks.map((p) => p.userId));

    return (
      <main>
        <p>
          <Link href={`/leagues/${leagueId}`}>&larr; Standings</Link>
        </p>
        <h1>
          Week {race.week} — {race.trackName}
        </h1>
        <p>
          {new Date(race.date).toLocaleDateString(undefined, {
            year: "numeric",
            month: "long",
            day: "numeric",
          })}
          {race.isNonPoints && " · non-points event"}
        </p>

        <h2>{myPick ? "Your pick" : "Make your pick"}</h2>
        <PickForm
          leagueId={leagueId}
          raceId={raceId}
          drivers={drivers}
          currentDriverId={myPick?.driverId ?? null}
        />

        <h2>Who&apos;s picked</h2>
        <ul>
          {members.map((m) => (
            <li key={m.userId}>
              {m.user.name ?? m.user.email} — {pickedUserIds.has(m.userId) ? "picked" : "not yet"}
            </li>
          ))}
        </ul>
      </main>
    );
  }

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

      {picks.length === 0 && <p>No picks were recorded for this race.</p>}

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
