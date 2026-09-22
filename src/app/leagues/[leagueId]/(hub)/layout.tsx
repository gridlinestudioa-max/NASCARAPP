import type { ReactNode } from "react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import Breadcrumb from "@/components/ui/Breadcrumb";
import LeagueHero from "@/components/league/LeagueHero";
import LeagueTabs from "@/components/league/LeagueTabs";
import LiveRefresh from "@/components/league/LiveRefresh";
import { getLeagueHubData } from "./leagueData";
import styles from "./layout.module.css";

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

  const { league, membership, season, standings, myRank, myStanding, races } = data;
  const racesCompleted = races.filter((r) => r.status === "COMPLETE").length;

  return (
    <main>
      <LiveRefresh />
      <div className={styles.topRow}>
        <Breadcrumb items={[{ label: "Home", href: "/" }, { label: league.name }]} />
        {membership.role === "OWNER" && (
          <Link
            href={`/leagues/${leagueId}/commissioner`}
            className={styles.settingsLink}
            aria-label="Commissioner settings"
            title="Commissioner settings"
          >
            <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="3" />
              <path
                d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </Link>
        )}
      </div>

      <LeagueHero
        leagueName={league.name}
        iconUrl={league.iconUrl}
        seasonYear={season?.year}
        total={myStanding?.total ?? 0}
        rank={myRank}
        memberCount={standings.length}
        racesCompleted={racesCompleted}
        racesTotal={races.length}
      />

      <LeagueTabs leagueId={leagueId} />

      {children}
    </main>
  );
}
