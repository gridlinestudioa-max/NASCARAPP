import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import Card from "@/components/ui/Card";
import PickemPickPanel from "@/components/league/PickemPickPanel";
import TieredLineupPickPanel from "@/components/league/TieredLineupPickPanel";
import { getLeagueHubData } from "./leagueData";

export const dynamic = "force-dynamic";

// The hub's default "Pick" tab — always the next open race, so a member
// lands straight on what they need to do instead of having to navigate to
// a separate race page. Same underlying panels as the standalone
// /leagues/[leagueId]/races/[raceId] route (which still works for any
// other week, e.g. reviewing a past one).
export default async function LeaguePickTabPage(props: { params: Promise<{ leagueId: string }> }) {
  const { leagueId } = await props.params;

  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }
  const userId = session.user.id;

  const data = await getLeagueHubData(leagueId, userId);
  if (!data) {
    notFound();
  }

  const { league, nextOpenRace } = data;

  if (!nextOpenRace) {
    return (
      <Card title="Pick">
        <p>No upcoming races scheduled for this league&apos;s season.</p>
      </Card>
    );
  }

  const leagueSeason = await prisma.leagueSeason.findUnique({
    where: { leagueId_seasonId: { leagueId, seasonId: nextOpenRace.seasonId } },
    include: { ruleSet: true, league: true },
  });
  if (!leagueSeason) {
    return (
      <Card title="Pick">
        <p>This league isn&apos;t part of a season yet.</p>
      </Card>
    );
  }

  return league.type === "TIERED_DRAFT" ? (
    <TieredLineupPickPanel
      leagueId={leagueId}
      raceId={nextOpenRace.id}
      userId={userId}
      race={nextOpenRace}
      leagueSeason={leagueSeason}
    />
  ) : (
    <PickemPickPanel
      leagueId={leagueId}
      raceId={nextOpenRace.id}
      userId={userId}
      race={nextOpenRace}
      leagueSeason={leagueSeason}
    />
  );
}
