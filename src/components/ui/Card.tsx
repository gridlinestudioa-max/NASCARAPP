import type { ReactNode } from "react";
import styles from "./Card.module.css";

export default function Card({
  title,
  actions,
  className,
  // "outside" (default, and the site-wide standard) prints the title
  // above the card as its own label with no shared border, matching the
  // reference design's section labels ("SUMMARY", "SPENDING BREAKDOWN").
  // "inside" is kept as an option for a card that specifically wants its
  // title sharing the card's own border/padding, but nothing currently
  // uses it.
  titlePlacement = "outside",
  // Opts out of the default max-width cap (see .outsideWrap) for a card
  // whose content is a genuinely wide multi-column table — e.g.
  // FullScoreMatrix, which can have a column per league member. Most
  // cards want the cap so they don't stretch edge-to-edge on a wide
  // screen; this is the deliberate exception, not the default.
  wide = false,
  children,
}: {
  title?: string;
  actions?: ReactNode;
  className?: string;
  titlePlacement?: "inside" | "outside";
  wide?: boolean;
  children: ReactNode;
}) {
  const cardBox = <section className={className ? `${styles.card} ${className}` : styles.card}>{children}</section>;

  if (titlePlacement === "outside") {
    return (
      <div className={wide ? `${styles.outsideWrap} ${styles.wide}` : styles.outsideWrap}>
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
