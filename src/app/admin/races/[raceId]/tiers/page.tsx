import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import Card from "@/components/ui/Card";
import TiersForm from "./TiersForm";

export const dynamic = "force-dynamic";

export default async function AssignTiersPage(props: PageProps<"/admin/races/[raceId]/tiers">) {
  const { raceId } = await props.params;

  const race = await prisma.race.findUnique({ where: { id: raceId } });
  if (!race) {
    notFound();
  }

  const [entries, allActiveDrivers, assignments] = await Promise.all([
    prisma.raceEntry.findMany({ where: { raceId }, include: { driver: true }, orderBy: { driver: { name: "asc" } } }),
    prisma.driver.findMany({ where: { isActive: true }, orderBy: { name: "asc" } }),
    prisma.driverTierAssignment.findMany({ where: { raceId } }),
  ]);
  const tierByDriverId = new Map(assignments.map((a) => [a.driverId, a.tier]));

  // Once this week's entry list is known (from a NASCAR sync), scope the
  // list to who's actually racing instead of every driver the site has
  // ever seen.
  const drivers = entries.length > 0 ? entries.map((e) => e.driver) : allActiveDrivers;
  const driverRows = drivers.map((d) => ({ driverId: d.id, name: d.name, tier: tierByDriverId.get(d.id) ?? null }));

  return (
    <main>
      <p>
        <Link href={`/admin/races/${raceId}`}>&larr; Week {race.week}</Link>
      </p>
      <h1>
        Assign weekly tiers — Week {race.week}, {race.trackName}
      </h1>
      <p>
        Shared across every Tiered Lineup league — sort each driver into Tier A, B, or C for this race based on
        this week&apos;s performance/ranking. Leave a driver unassigned if they aren&apos;t in play this week.
      </p>
      <Card>
        <TiersForm raceId={raceId} drivers={driverRows} />
      </Card>
    </main>
  );
}
