import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import Card from "@/components/ui/Card";
import Breadcrumb from "@/components/ui/Breadcrumb";
import { displayRaceName } from "@/lib/raceName";
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
  const assignmentByDriverId = new Map(assignments.map((a) => [a.driverId, a]));

  // Once this week's entry list is known (from a NASCAR sync), scope the
  // list to who's actually racing instead of every driver the site has
  // ever seen.
  const drivers = entries.length > 0 ? entries.map((e) => e.driver) : allActiveDrivers;
  const driverRows = drivers.map((d) => {
    const assignment = assignmentByDriverId.get(d.id);
    return {
      driverId: d.id,
      name: d.name,
      tier: assignment?.tier ?? null,
      source: assignment?.source ?? null,
    };
  });

  return (
    <main>
      <Breadcrumb
        items={[
          { label: "Admin", href: "/admin" },
          { label: displayRaceName(race.trackName), href: `/admin/races/${raceId}` },
          { label: "Tiers" },
        ]}
      />
      <h1>
        Assign weekly tiers — Week {race.week}, {displayRaceName(race.trackName)}
      </h1>
      <p>
        Shared across every Tiered Lineup league. Tiers now recompute automatically (season points/recent form/track
        history) every time this week&apos;s entry list, qualifying, or results sync — no click required. Hand-edit
        a driver and save below to pin it; a pinned tier stands until you clear it here or hit &ldquo;Auto-assign
        tiers&rdquo; again. Leave a driver unassigned if they aren&apos;t in play this week. Tiers freeze once
        lineups lock.
      </p>
      <Card>
        <TiersForm raceId={raceId} drivers={driverRows} />
      </Card>
    </main>
  );
}
