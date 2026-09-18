import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import Card from "@/components/ui/Card";
import QualifyingForm from "./QualifyingForm";

export const dynamic = "force-dynamic";

export default async function EnterQualifyingPage(props: PageProps<"/admin/races/[raceId]/qualifying">) {
  const { raceId } = await props.params;

  const race = await prisma.race.findUnique({ where: { id: raceId } });
  if (!race) {
    notFound();
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
        <Link href={`/admin/races/${raceId}`}>&larr; Week {race.week}</Link>
      </p>
      <h1>
        Enter qualifying results — Week {race.week}, {race.trackName}
      </h1>
      <Card>
        {drivers.length === 0 ? (
          <p>
            No drivers have been tier-assigned for this race yet —{" "}
            <Link href={`/admin/races/${raceId}/tiers`}>assign tiers</Link> first.
          </p>
        ) : (
          <QualifyingForm raceId={raceId} drivers={drivers} />
        )}
      </Card>
    </main>
  );
}
