import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import Breadcrumb from "@/components/ui/Breadcrumb";
import DriverStatsTable, { type DriverStatRow } from "@/components/stats/DriverStatsTable";
import { computeSeasonPointsStandings } from "@/lib/seasonPoints";
import styles from "./page.module.css";

export const dynamic = "force-dynamic";

export default async function StatsPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const season = await prisma.season.findFirst({ orderBy: { year: "desc" } });
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

      <p>
        <small>
          Computed from our own synced results using the 2026 Cup points system — NASCAR doesn&apos;t expose a
          persistent standings feed we can pull from, only a live leaderboard that only exists while a race is
          actually green-flag live. Finish points (55 for a win, then 37 minus position, floor of 1) plus stage
          points, first 26 races. After that, the top 16 get reset to their Chase seed and the last 10 races add on
          top of that — everyone else keeps accumulating normally.
        </small>
      </p>

      {drivers.length === 0 ? (
        <p>No results have been entered yet.</p>
      ) : (
        <>
          <div className={styles.legend}>
            <span className={styles.legendSwatch} />
            <span className={styles.legendLabel}>Top 16 — Playoff / Chase field</span>
          </div>
          <DriverStatsTable drivers={drivers} />
        </>
      )}
    </main>
  );
}
