import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import Breadcrumb from "@/components/ui/Breadcrumb";
import LiveRefresh from "@/components/league/LiveRefresh";
import PickemPickPanel from "@/components/league/PickemPickPanel";
import TieredLineupPickPanel from "@/components/league/TieredLineupPickPanel";
import { displayRaceName } from "@/lib/raceName";

export const dynamic = "force-dynamic";

export default async function RaceDetailPage(props: PageProps<"/leagues/[leagueId]/races/[raceId]">) {
  const { leagueId, raceId } = await props.params;

  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }
  const userId = session.user.id;

  const membership = await prisma.leagueMembership.findUnique({
    where: { leagueId_userId: { leagueId, userId } },
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
    include: { ruleSet: true, league: true },
  });
  if (!leagueSeason) {
    notFound();
  }

  return (
    <main>
      <LiveRefresh />
      <Breadcrumb
        items={[
          { label: "Home", href: "/" },
          { label: leagueSeason.league.name, href: `/leagues/${leagueId}` },
          { label: displayRaceName(race.trackName) },
        ]}
      />
      <h1>
        Week {race.week} — {displayRaceName(race.trackName)}
      </h1>
      <p>
        {race.venueName && <>{race.venueName} · </>}
        {new Date(race.date).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" })}
      </p>

      {leagueSeason.league.type === "TIERED_DRAFT" ? (
        <TieredLineupPickPanel leagueId={leagueId} raceId={raceId} userId={userId} race={race} leagueSeason={leagueSeason} />
      ) : (
        <PickemPickPanel leagueId={leagueId} raceId={raceId} userId={userId} race={race} leagueSeason={leagueSeason} />
      )}
    </main>
  );
}
