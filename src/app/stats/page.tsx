import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import Breadcrumb from "@/components/ui/Breadcrumb";
import DriverStatsTable, { type DriverStatRow } from "@/components/stats/DriverStatsTable";
import { computeSeasonPointsStandings } from "@/lib/seasonPoints";
import { getCurrentSeason } from "@/lib/season";
import styles from "./page.module.css";

export const dynamic = "force-dynamic";

export default async function StatsPage(props: PageProps<"/stats">) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const searchParams = await props.searchParams;
  const initialSelectedId = typeof searchParams.driver === "string" ? searchParams.driver : null;

  const season = await getCurrentSeason();
  const pointsStandings = season ? await computeSeasonPointsStandings(season.id) : [];

  const driverProfiles = pointsStandings.length
    ? await prisma.driver.findMany({
        where: { id: { in: pointsStandings.map((e) => e.driverId) } },
        select: { id: true, team: true, number: true, bio: true },
      })
    : [];
  const profileById = new Map(driverProfiles.map((d) => [d.id, d]));

  const drivers: DriverStatRow[] = pointsStandings.map((e) => ({
    driverId: e.driverId,
    driverName: e.driverName,
    team: profileById.get(e.driverId)?.team ?? null,
    number: profileById.get(e.driverId)?.number ?? null,
    bio: profileById.get(e.driverId)?.bio ?? null,
    points: e.points,
    wins: e.wins,
    top5: e.top5,
    top10: e.top10,
    races: e.races,
    avgFinish: e.avgFinish,
    inChase: e.inChase,
  }));

  return (
    <main>
      <Breadcrumb items={[{ label: "Dashboards" }, { label: "Driver Stats" }]} />
      <h1>Driver Stats</h1>
      <p className={styles.sub}>
        {season && `${season.year} season · `}ranked by year points
      </p>

      {drivers.length === 0 ? (
        <p>No results have been entered yet.</p>
      ) : (
        <>
          <div className={styles.legend}>
            <span className={styles.legendSwatch} />
            <span className={styles.legendLabel}>Top 16 — Playoff / Chase field</span>
          </div>
          <DriverStatsTable drivers={drivers} initialSelectedId={initialSelectedId} />
        </>
      )}
    </main>
  );
}
