"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import styles from "./LeagueTabs.module.css";

const TABS = [
  { href: "", label: "Standings" },
  { href: "/personal-stats", label: "Personal Stats" },
  { href: "/league-stats", label: "League Stats" },
  { href: "/driver-selection", label: "Driver Selection" },
  { href: "/past-scores", label: "Past Scores" },
];

export default function LeagueTabs({ leagueId }: { leagueId: string }) {
  const pathname = usePathname();
  const base = `/leagues/${leagueId}`;

  return (
    <nav className={styles.tabs}>
      {TABS.map((tab) => {
        const href = `${base}${tab.href}`;
        const active = pathname === href;
        return (
          <Link key={tab.href} href={href} className={active ? `${styles.tab} ${styles.active}` : styles.tab}>
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
