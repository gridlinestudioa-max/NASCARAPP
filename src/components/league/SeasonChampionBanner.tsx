import styles from "./SeasonChampionBanner.module.css";

export default function SeasonChampionBanner({
  seasonYear,
  championName,
  total,
}: {
  seasonYear: number;
  championName: string;
  total: number;
}) {
  return (
    <div className={styles.banner}>
      <div className={styles.label}>{seasonYear} Season Champion</div>
      <div className={styles.name}>{championName}</div>
      <div className={styles.score}>{total.toLocaleString()} points</div>
    </div>
  );
}
