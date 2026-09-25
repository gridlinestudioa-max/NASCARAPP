import Link from "next/link";
import { prisma } from "@/lib/prisma";
import Card from "@/components/ui/Card";
import Breadcrumb from "@/components/ui/Breadcrumb";
import DriverRosterPanel from "@/components/admin/DriverRosterPanel";
import SeasonScheduleCard from "@/components/admin/SeasonScheduleCard";
import AdvanceSeasonButton from "@/components/admin/AdvanceSeasonButton";
import { getAllDriversForSeasonAdmin, getCurrentSeason, getOrCreateNextSeason } from "@/lib/season";
import styles from "./page.module.css";

export const dynamic = "force-dynamic";

export default async function SeasonSetupPage(props: PageProps<"/admin/season-setup">) {
  const searchParams = await props.searchParams;
  const tab = searchParams.tab === "next" ? "next" : "this";

  const currentSeason = await getCurrentSeason();
  if (!currentSeason) {
    return (
      <main>
        <Breadcrumb items={[{ label: "Admin", href: "/admin" }, { label: "Season Setup" }]} />
        <h1>Season Setup</h1>
        <p>No season has been created yet — seed one before using this page.</p>
      </main>
    );
  }
  const nextSeason = await getOrCreateNextSeason(currentSeason.year);

  const [thisYearRaces, nextYearRaces, continuingLeagueCount] = await Promise.all([
    prisma.race.findMany({ where: { seasonId: currentSeason.id }, orderBy: { week: "asc" } }),
    prisma.race.findMany({ where: { seasonId: nextSeason.id }, orderBy: { week: "asc" } }),
    prisma.leagueSeason.count({ where: { seasonId: currentSeason.id } }),
  ]);

  const activeSeason = tab === "next" ? nextSeason : currentSeason;
  const activeRaces = tab === "next" ? nextYearRaces : thisYearRaces;
  // "Previous" relative to whichever tab is active — Next Year duplicates
  // from This Year; This Year is read-only and never duplicates from
  // anything, so it's only computed for the Next Year tab.
  const previousSeasonId = tab === "next" ? currentSeason.id : null;
  const drivers = await getAllDriversForSeasonAdmin(activeSeason.id);

  return (
    <main>
      <Breadcrumb items={[{ label: "Admin", href: "/admin" }, { label: "Season Setup" }]} />
      <h1>Season Setup</h1>
      <p>
        Manage the driver roster and race schedule for the current season and prep next year&apos;s ahead of time —
        nothing here goes live site-wide until you advance the season below.
      </p>

      <nav className={styles.tabs}>
        <Link
          href="/admin/season-setup?tab=this"
          className={tab === "this" ? `${styles.tab} ${styles.tabActive}` : styles.tab}
        >
          This Year ({currentSeason.year})
        </Link>
        <Link
          href="/admin/season-setup?tab=next"
          className={tab === "next" ? `${styles.tab} ${styles.tabActive}` : styles.tab}
        >
          Next Year ({nextSeason.year})
        </Link>
      </nav>

      <Card title={`${activeSeason.year} schedule`}>
        <SeasonScheduleCard
          seasonId={activeSeason.id}
          races={activeRaces.map(toRaceRow)}
          editable={tab === "next"}
          previousSeasonId={previousSeasonId}
        />
      </Card>

      <Card title="Driver roster">
        <DriverRosterPanel
          drivers={drivers}
          editable={tab === "next"}
          seasonId={activeSeason.id}
          previousSeasonId={previousSeasonId}
        />
      </Card>

      {tab === "next" && (
        <Card title="Advance the season">
          <AdvanceSeasonButton
            currentYear={currentSeason.year}
            nextYear={nextSeason.year}
            nextYearRaceCount={nextYearRaces.length}
            continuingLeagueCount={continuingLeagueCount}
          />
        </Card>
      )}
    </main>
  );
}

function toRaceRow(r: {
  id: string;
  week: number;
  trackName: string;
  date: Date;
  fieldSize: number;
  isNonPoints: boolean;
  status: string;
  logoOverride: string | null;
}) {
  return {
    id: r.id,
    week: r.week,
    trackName: r.trackName,
    date: r.date.toISOString().slice(0, 10),
    fieldSize: r.fieldSize,
    isNonPoints: r.isNonPoints,
    status: r.status,
    logoOverride: r.logoOverride,
  };
}
