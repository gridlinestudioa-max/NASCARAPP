import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import Breadcrumb from "@/components/ui/Breadcrumb";
import LeagueRulesForm from "@/components/LeagueRulesForm";
import { displayRaceName } from "@/lib/raceName";

export const dynamic = "force-dynamic";

export default async function NewLeaguePage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const [racesWithResults, season, driverPoolSize] = await Promise.all([
    prisma.race.findMany({ where: { results: { some: {} } }, orderBy: { week: "asc" } }),
    prisma.season.findFirst({ orderBy: { year: "desc" } }),
    prisma.driver.count(),
  ]);
  const completedRaces = racesWithResults.map((r) => ({ id: r.id, label: `Week ${r.week} — ${displayRaceName(r.trackName)}` }));

  const [seasonRaceCount, seasonNonPointsRaceCount] = season
    ? await Promise.all([
        prisma.race.count({ where: { seasonId: season.id } }),
        prisma.race.count({ where: { seasonId: season.id, isNonPoints: true } }),
      ])
    : [0, 0];

  return (
    <main>
      <Breadcrumb items={[{ label: "Home", href: "/" }, { label: "Create a League" }]} />
      <h1>Create a league</h1>
      <p>You&apos;ll be the owner and can invite others once it&apos;s created.</p>
      <LeagueRulesForm
        completedRaces={completedRaces}
        driverPoolSize={driverPoolSize}
        seasonRaceCount={seasonRaceCount}
        seasonNonPointsRaceCount={seasonNonPointsRaceCount}
      />
    </main>
  );
}
