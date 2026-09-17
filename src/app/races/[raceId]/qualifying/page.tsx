import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ownsALeagueInSeason } from "@/lib/authz";
import QualifyingForm from "./QualifyingForm";

export const dynamic = "force-dynamic";

export default async function EnterQualifyingPage(props: PageProps<"/races/[raceId]/qualifying">) {
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

  // The full weekly tier pool needs a qualifying position — every rostered
  // driver (starter or bench) in a Tiered Lineup league scores on it, not
  // just whoever's currently in a lineup.
  const tierAssignments = await prisma.driverTierAssignment.findMany({
    where: { raceId },
    include: { driver: true },
    orderBy: { driver: { name: "asc" } },
  });
  const driverIds = tierAssignments.map((a) => a.driverId);
  const existingResults = await prisma.qualifyingResult.findMany({ where: { raceId, driverId: { in: driverIds } } });
  const positionByDriverId = new Map(existingResults.map((r) => [r.driverId, r.qualifyingPosition]));

  const drivers = tierAssignments.map((a) => ({
    driverId: a.driverId,
    name: a.driver.name,
    tier: a.tier,
    qualifyingPosition: positionByDriverId.get(a.driverId) ?? null,
  }));

  return (
    <main>
      <p>
        <Link href={`/races/${raceId}`}>&larr; Week {race.week}</Link>
      </p>
      <h1>
        Enter qualifying results — Week {race.week}, {race.trackName}
      </h1>
      {drivers.length === 0 ? (
        <p>
          No drivers have been tier-assigned for this race yet —{" "}
          <Link href={`/races/${raceId}/tiers`}>assign tiers</Link> first.
        </p>
      ) : (
        <QualifyingForm raceId={raceId} drivers={drivers} />
      )}
    </main>
  );
}
