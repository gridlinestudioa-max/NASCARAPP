import styles from "./PointsDonut.module.css";

export type DonutSlice = { name: string; pct: number; color: string };

export default function PointsDonut({
  slices,
  centerValue,
  centerLabel,
}: {
  slices: DonutSlice[];
  centerValue: string;
  centerLabel: string;
}) {
  let acc = 0;
  const stops = slices.map((s) => {
    const start = acc;
    acc += s.pct;
    return `${s.color} ${start}% ${acc}%`;
  });
  const gradient = acc > 0 ? `conic-gradient(${stops.join(", ")})` : "var(--border-color)";

  return (
    <div className={styles.wrap}>
      <div className={styles.ringOuter}>
        <div className={styles.ring} style={{ background: gradient }}>
          <div className={styles.ringCenter}>
            <div className={styles.centerValue}>{centerValue}</div>
            <div className={styles.centerLabel}>{centerLabel}</div>
          </div>
        </div>
      </div>
      <div className={styles.legend}>
        {slices.map((s) => (
          <div key={s.name} className={styles.legendRow}>
            <span className={styles.legendDot} style={{ background: s.color }} />
            <span className={styles.legendName}>{s.name}</span>
            <span className={styles.legendPct}>{s.pct}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}
