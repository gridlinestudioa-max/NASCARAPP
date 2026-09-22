import Link from "next/link";
import styles from "./Breadcrumb.module.css";

export default function Breadcrumb({ items }: { items: { label: string; href?: string }[] }) {
  return (
    <div className={styles.breadcrumb}>
      {items.map((item, i) => {
        const isLast = i === items.length - 1;
        return (
          <span key={i} className={styles.segment}>
            {i > 0 && <span className={styles.separator}>›</span>}
            {!isLast && item.href ? (
              <Link href={item.href} className={styles.link}>
                {item.label}
              </Link>
            ) : (
              <span className={isLast ? styles.current : undefined}>{item.label}</span>
            )}
          </span>
        );
      })}
    </div>
  );
}
