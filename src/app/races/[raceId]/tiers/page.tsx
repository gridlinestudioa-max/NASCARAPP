import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ownsALeagueInSeason } from "@/lib/authz";
import TiersForm from "./TiersForm";

export const dynamic = "force-dynamic";

export default async function AssignTiersPage(props: PageProps<"/races/[raceId]/tiers">) {
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

  const [drivers, assignments] = await Promise.all([
    prisma.driver.findMany({ where: { isActive: true }, orderBy: { name: "asc" } }),
    prisma.driverTierAssignment.findMany({ where: { raceId } }),
  ]);
  const tierByDriverId = new Map(assignments.map((a) => [a.driverId, a.tier]));

  const driverRows = drivers.map((d) => ({ driverId: d.id, name: d.name, tier: tierByDriverId.get(d.id) ?? null }));

  return (
    <main>
      <p>
        <Link href={`/races/${raceId}`}>&larr; Week {race.week}</Link>
      </p>
      <h1>
        Assign weekly tiers — Week {race.week}, {race.trackName}
      </h1>
      <p>
        Shared across every Tiered Lineup league — sort each driver into Tier A, B, or C for this race based on
        this week&apos;s performance/ranking. Leave a driver unassigned if they aren&apos;t in play this week.
      </p>
      <TiersForm raceId={raceId} drivers={driverRows} />
    </main>
  );
}
