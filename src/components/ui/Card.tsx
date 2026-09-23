import type { ReactNode } from "react";
import styles from "./Card.module.css";

export default function Card({
  title,
  actions,
  className,
  // "inside" (default) renders the title inside the card's own border/
  // padding, as most of the site does. "outside" instead prints it above
  // the card as its own label with no shared border — the layout the
  // Stats tab now uses, matching the reference design's section labels
  // ("SUMMARY", "SPENDING BREAKDOWN") that sit above their box rather
  // than inside it.
  titlePlacement = "inside",
  children,
}: {
  title?: string;
  actions?: ReactNode;
  className?: string;
  titlePlacement?: "inside" | "outside";
  children: ReactNode;
}) {
  const cardBox = <section className={className ? `${styles.card} ${className}` : styles.card}>{children}</section>;

  if (titlePlacement === "outside") {
    return (
      <div className={styles.outsideWrap}>
        {(title || actions) && (
          <div className={styles.outsideHeader}>
            {title && <h2 className={styles.outsideTitle}>{title}</h2>}
            {actions && <div className={styles.actions}>{actions}</div>}
          </div>
        )}
        {cardBox}
      </div>
    );
  }

  return (
    <section className={className ? `${styles.card} ${className}` : styles.card}>
      {(title || actions) && (
        <div className={styles.header}>
          {title && <h2 className={styles.title}>{title}</h2>}
          {actions && <div className={styles.actions}>{actions}</div>}
        </div>
      )}
      {children}
    </section>
  );
}
