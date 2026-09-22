import Card from "@/components/ui/Card";
import { ordinal } from "@/lib/leagueStats";
import styles from "./LeagueHero.module.css";

export default function LeagueHero({
  leagueName,
  seasonYear,
  total,
  rank,
  memberCount,
  racesCompleted,
  racesTotal,
}: {
  leagueName: string;
  seasonYear?: number;
  total: number;
  rank: number | null;
  memberCount: number;
  racesCompleted?: number;
  racesTotal?: number;
}) {
  const remaining = racesTotal != null && racesCompleted != null ? Math.max(racesTotal - racesCompleted, 0) : null;

  return (
    <Card>
      <div className={styles.identity}>
        <div className={styles.avatar}>{leagueName.charAt(0).toUpperCase()}</div>
        <div>
          <h1 className={styles.name}>{leagueName}</h1>
          {seasonYear && (
            <div className={styles.sub}>
              {seasonYear} season
              {racesTotal != null && racesTotal > 0 && (
                <> · Race {racesCompleted} of {racesTotal} · {remaining} remaining</>
              )}
            </div>
          )}
        </div>
      </div>

      <div className={styles.stats}>
        <div>
          <div className={styles.statValue}>{total}</div>
          <div className={styles.statLabel}>Season Score</div>
        </div>
        <div>
          <div className={styles.statValue}>{rank ? ordinal(rank) : "—"}</div>
          <div className={styles.statLabel}>Rank of {memberCount}</div>
        </div>
      </div>
    </Card>
  );
}
