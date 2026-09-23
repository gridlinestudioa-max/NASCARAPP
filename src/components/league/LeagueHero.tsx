import Card from "@/components/ui/Card";
import UserAvatar from "@/components/ui/UserAvatar";
import { ordinal } from "@/lib/leagueStats";
import styles from "./LeagueHero.module.css";

export default function LeagueHero({
  leagueName,
  iconUrl,
  seasonYear,
  total,
  rank,
  memberCount,
  racesCompleted,
  racesTotal,
  leader,
}: {
  leagueName: string;
  iconUrl?: string | null;
  seasonYear?: number;
  total: number;
  rank: number | null;
  memberCount: number;
  racesCompleted?: number;
  racesTotal?: number;
  leader?: { name: string; avatarUrl: string | null; total: number; isMe: boolean } | null;
}) {
  const remaining = racesTotal != null && racesCompleted != null ? Math.max(racesTotal - racesCompleted, 0) : null;

  return (
    <Card>
      <div className={styles.topRow}>
        <div className={styles.identity}>
          {iconUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- commissioner-pasted URL, not a static/local asset
            <img src={iconUrl} alt="" className={styles.avatarImg} />
          ) : (
            <div className={styles.avatar}>{leagueName.charAt(0).toUpperCase()}</div>
          )}
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

        {leader && (
          <div className={styles.leaderBlock}>
            <div className={styles.leaderLabel}>League Leader</div>
            <div className={styles.leaderInfo}>
              <div className={styles.leaderText}>
                <div className={styles.leaderName}>{leader.isMe ? "You" : leader.name}</div>
                <div className={styles.leaderScore}>{leader.total.toLocaleString()} pts</div>
              </div>
              <UserAvatar name={leader.name} avatarUrl={leader.avatarUrl} size="md" />
            </div>
          </div>
        )}
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
