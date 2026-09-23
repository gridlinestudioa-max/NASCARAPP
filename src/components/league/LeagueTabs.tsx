"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import styles from "./LeagueTabs.module.css";

const TABS = [
  { href: "", label: "Pick" },
  { href: "/standings", label: "Standings" },
  { href: "/stats", label: "Stats" },
  { href: "/league", label: "League" },
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
