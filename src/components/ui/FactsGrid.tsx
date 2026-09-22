import type { ReactNode } from "react";
import styles from "./FactsGrid.module.css";

export type Fact = { label: string; value: ReactNode; fullWidth?: boolean };

export default function FactsGrid({ items, columns = 2 }: { items: Fact[]; columns?: number }) {
  return (
    <div className={styles.grid} style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}>
      {items.map((item) => (
        <div key={item.label} className={item.fullWidth ? styles.fullWidth : undefined}>
          <div className={styles.label}>{item.label}</div>
          <div className={styles.value}>{item.value}</div>
        </div>
      ))}
    </div>
  );
}
