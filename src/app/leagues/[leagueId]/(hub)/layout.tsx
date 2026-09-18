import type { ReactNode } from "react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import Card from "@/components/ui/Card";
import LeagueHero from "@/components/league/LeagueHero";
import LeagueTabs from "@/components/league/LeagueTabs";
import LiveRefresh from "@/components/league/LiveRefresh";
import { getLeagueHubData } from "./leagueData";

export const dynamic = "force-dynamic";

export default async function LeagueHubLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ leagueId: string }>;
}) {
  const { leagueId } = await params;

  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const data = await getLeagueHubData(leagueId, session.user.id);
  if (!data) {
    // Either the league doesn't exist or this user isn't a member — hide
    // the league's existence rather than exposing a "you're not allowed"
    // distinction.
    notFound();
  }

  const { league, membership, season, standings, myRank, myStanding, nextOpenRace, races } = data;
  const racesCompleted = races.filter((r) => r.status === "COMPLETE").length;

  return (
    <main>
      <LiveRefresh />
      <p>
        <Link href="/my-leagues">&larr; My Leagues</Link>
      </p>

      <LeagueHero
        leagueName={league.name}
        seasonYear={season?.year}
        total={myStanding?.total ?? 0}
        rank={myRank}
        memberCount={standings.length}
        racesCompleted={racesCompleted}
        racesTotal={races.length}
      />

      {membership.role === "OWNER" && (
        <Card>
          <p>
            Invite code: <code>{league.inviteCode}</code> — share it so others can{" "}
            <Link href="/leagues/join">join this league</Link>. Manage in{" "}
            <Link href={`/leagues/${league.id}/settings`}>league settings</Link>.
          </p>
        </Card>
      )}

      {nextOpenRace && (
        <Card title="Up next">
          <Link href={`/leagues/${league.id}/races/${nextOpenRace.id}`}>
            Make your pick for Week {nextOpenRace.week} — {nextOpenRace.trackName}
          </Link>
        </Card>
      )}

      <LeagueTabs leagueId={leagueId} />

      {children}
    </main>
  );
}
