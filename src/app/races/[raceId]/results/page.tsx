import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ownsALeagueInSeason } from "@/lib/authz";
import ResultsForm from "./ResultsForm";

export const dynamic = "force-dynamic";

export default async function EnterResultsPage(props: PageProps<"/races/[raceId]/results">) {
  const { raceId } = await props.params;

  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const race = await prisma.race.findUnique({ where: { id: raceId } });
  if (!race) {
    notFound();
  }

  const authorized = await ownsALeagueInSeason(session.user.id, race.seasonId);
  if (!authorized) {
    redirect(`/races/${raceId}`);
  }

  // Only drivers someone actually picked for this race need a finishing
  // position entered — that's the minimum needed to score every pick on
  // it, across every league sharing this race.
  const picks = await prisma.pick.findMany({
    where: { raceId },
    include: { driver: true },
    distinct: ["driverId"],
    orderBy: { driver: { name: "asc" } },
  });
  const existingResults = await prisma.raceResult.findMany({
    where: { raceId, driverId: { in: picks.map((p) => p.driverId) } },
  });
  const resultByDriverId = new Map(existingResults.map((r) => [r.driverId, r.finishingPosition]));

  const drivers = picks.map((p) => ({
    driverId: p.driverId,
    name: p.driver.name,
    finishPosition: resultByDriverId.get(p.driverId) ?? null,
  }));

  return (
    <main>
      <p>
        <Link href={`/races/${raceId}`}>&larr; Week {race.week}</Link>
      </p>
      <h1>
        Enter results — Week {race.week}, {race.trackName}
      </h1>
      {drivers.length === 0 ? (
        <p>No picks were made for this race in any league — nothing to score.</p>
      ) : (
        <ResultsForm raceId={raceId} drivers={drivers} />
      )}
    </main>
  );
}
