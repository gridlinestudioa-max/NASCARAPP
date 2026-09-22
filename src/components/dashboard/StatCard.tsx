import styles from "./StatCard.module.css";

export default function StatCard({ label, value, delta }: { label: string; value: string; delta?: string }) {
  return (
    <div className={styles.card}>
      <div className={styles.label}>{label}</div>
      <div className={styles.value}>{value}</div>
      {delta && <div className={styles.delta}>{delta}</div>}
    </div>
  );
}
