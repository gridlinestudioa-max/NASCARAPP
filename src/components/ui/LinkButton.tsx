import Link from "next/link";
import type { ReactNode } from "react";
import styles from "./LinkButton.module.css";

// A <Link> styled to match the site's secondary button[type="button"]
// look (see globals.css) — for places that need a button-shaped nav
// target rather than a plain inline text link. `external` opens the link
// in a new tab with rel="noopener noreferrer" (reverse-tabnabbing
// protection) — set it for any href leaving the site.
export default function LinkButton({
  href,
  children,
  external = false,
}: {
  href: string;
  children: ReactNode;
  external?: boolean;
}) {
  return (
    <Link
      href={href}
      className={styles.linkButton}
      {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
    >
      {children}
    </Link>
  );
}
