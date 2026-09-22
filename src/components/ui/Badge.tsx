import type { ReactNode } from "react";
import styles from "./Badge.module.css";

type Tone = "neutral" | "ink" | "accent" | "success" | "warning" | "danger";

export default function Badge({ tone = "neutral", children }: { tone?: Tone; children: ReactNode }) {
  return <span className={`${styles.badge} ${styles[tone]}`}>{children}</span>;
}
