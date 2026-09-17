import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { parseRuleSetConfig } from "@/lib/scoring";
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

  const race = await prisma.race.findUnique({ where: { id: raceId } });
  if (!race) {
    notFound();
  }
  // Scope to this league: a race id that's real but belongs to a season
  // this league doesn't take part in shouldn't be reachable through this URL.
  const leagueSeason = await prisma.leagueSeason.findUnique({
    where: { leagueId_seasonId: { leagueId, seasonId: race.seasonId } },
    include: { ruleSet: true },
  });
  if (!leagueSeason) {
    notFound();
  }
  const config = parseRuleSetConfig(leagueSeason.ruleSet.config);

  const picks = await prisma.pick.findMany({
    where: { leagueId, raceId },
    include: { user: true, driver: true, score: true },
    orderBy: [{ score: { total: "desc" } }, { pickNumber: "asc" }],
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
    const myPicks = picks
      .filter((p) => p.userId === session.user!.id)
      .sort((a, b) => a.pickNumber - b.pickNumber);
    const currentDriverIdBySlot = Array.from(
      { length: config.picksPerWeek },
      (_, i) => myPicks.find((p) => p.pickNumber === i + 1)?.driverId ?? null,
    );
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
        </p>

        <h2>{myPicks.length > 0 ? "Your pick" : "Make your pick"}</h2>
        <PickForm
          leagueId={leagueId}
          raceId={raceId}
          drivers={drivers}
          picksPerWeek={config.picksPerWeek}
          currentDriverIdBySlot={currentDriverIdBySlot}
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
      <p>Field size {race.fieldSize}</p>

      {membership.role === "OWNER" && (
        <p>
          <Link href={`/races/${raceId}/results`}>{hasResults ? "Edit results" : "Enter results"}</Link>
        </p>
      )}

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
