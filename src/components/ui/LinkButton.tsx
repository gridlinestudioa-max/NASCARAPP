import Link from "next/link";
import type { ReactNode } from "react";
import styles from "./LinkButton.module.css";

// A <Link> styled to match the site's secondary button[type="button"]
// look (see globals.css) — for places that need a button-shaped nav
// target rather than a plain inline text link.
export default function LinkButton({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className={styles.linkButton}>
      {children}
    </Link>
  );
}
