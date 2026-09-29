import type { CSSProperties } from "react";
import styles from "./Skeleton.module.css";

// A single shimmering placeholder block — the primitive every loading.tsx
// in the app composes into a page-shaped skeleton. CSS-driven (no JS
// animation library) so it starts shimmering the instant a route's
// Suspense boundary renders, with no hydration gap.
export function Skeleton({
  width = "100%",
  height = 14,
  radius = 6,
  className,
  style,
}: {
  width?: number | string;
  height?: number | string;
  radius?: number | string;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <span
      className={className ? `${styles.bone} ${className}` : styles.bone}
      style={{ width, height, borderRadius: radius, ...style }}
    />
  );
}

// The Card chrome (see Card.module.css) filled with placeholder lines
// instead of real content — what every data-fetching page shows in its
// loading.tsx while the server component behind it is still querying.
export function SkeletonCard({
  title = true,
  rows = 3,
  className,
}: {
  title?: boolean;
  rows?: number;
  className?: string;
}) {
  return (
    <div className={styles.outsideWrap}>
      {title && (
        <div className={styles.outsideHeader}>
          <Skeleton width={120} height={12} radius={4} />
        </div>
      )}
      <section className={className ? `${styles.card} ${className}` : styles.card}>
        <div className={styles.rows}>
          {Array.from({ length: rows }).map((_, i) => (
            <Skeleton key={i} height={16} />
          ))}
        </div>
      </section>
    </div>
  );
}
