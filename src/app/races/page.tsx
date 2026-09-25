import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import Badge from "@/components/ui/Badge";
import Breadcrumb from "@/components/ui/Breadcrumb";
import RaceLogo from "@/components/ui/RaceLogo";
import { displayRaceName } from "@/lib/raceName";
import { getCurrentSeason } from "@/lib/season";
import styles from "./page.module.css";

export const dynamic = "force-dynamic";

function findNextRaceIndex(races: { date: Date }[]): number {
  const now = Date.now();
  return races.findIndex((r) => r.date.getTime() >= now);
}

export default async function SchedulePage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const season = await getCurrentSeason();
  const races = season
    ? await prisma.race.findMany({ where: { seasonId: season.id }, orderBy: { week: "asc" } })
    : [];

  const nextIndex = findNextRaceIndex(races);

  const monthGroups = new Map<string, typeof races>();
  races.forEach((r) => {
    const label = new Date(r.date).toLocaleDateString(undefined, { month: "long", year: "numeric" });
    const group = monthGroups.get(label) ?? [];
    group.push(r);
    monthGroups.set(label, group);
  });

  return (
    <main>
      <Breadcrumb items={[{ label: "Dashboards" }, { label: "Schedule" }]} />
      <div className={styles.header}>
        <div>
          <h1>Schedule</h1>
          {season && (
            <p className={styles.headerSub}>
              {season.year} season · {races.length} races
            </p>
          )}
        </div>
        <div className={styles.legend}>
          <span className={styles.legendItem}>
            <span className={`${styles.legendDot} ${styles.legendDotFaint}`} /> Final
          </span>
          <span className={styles.legendItem}>
            <span className={`${styles.legendDot} ${styles.legendDotAccent}`} /> Next up
          </span>
        </div>
      </div>

      {races.length === 0 ? (
        <p>No schedule has been set up yet.</p>
      ) : (
        [...monthGroups.entries()].map(([label, monthRaces]) => (
          <div key={label} className={styles.monthGroup}>
            <h3 className={styles.monthLabel}>{label}</h3>
            <div className={styles.monthCard}>
              {monthRaces.map((r) => {
                const isNext = races.indexOf(r) === nextIndex;
                const isComplete = r.status === "COMPLETE" || (nextIndex !== -1 && races.indexOf(r) < nextIndex && !isNext);
                return (
                  <Link key={r.id} href={`/races/${r.id}`} className={styles.raceRow}>
                    <span className={styles.weekChip}>{r.week}</span>
                    <RaceLogo
                      trackName={r.trackName}
                      size={48}
                      className={styles.raceLogo}
                      overrideSrc={r.logoOverride}
                    />
                    <span className={styles.raceInfo}>
                      <span className={styles.trackName}>{r.venueName ?? displayRaceName(r.trackName)}</span>
                      {r.venueName && <span className={styles.venueName}>{displayRaceName(r.trackName)}</span>}
                    </span>
                    <span className={styles.raceMeta}>
                      {isNext && <Badge tone="accent">Next Up</Badge>}
                      {isComplete && <Badge tone="neutral">Final</Badge>}
                      <span className={styles.dateLabel}>
                        {new Date(r.date).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                      </span>
                    </span>
                  </Link>
                );
              })}
            </div>
          </div>
        ))
      )}
    </main>
  );
}
