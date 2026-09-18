"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { signOutAction } from "@/app/actions";
import styles from "./AppShell.module.css";

const NAV_ITEMS = [
  {
    href: "/my-leagues",
    label: "My Leagues",
    icon: (
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none">
        <rect x="3" y="3" width="8" height="8" rx="2" fill="currentColor" />
        <rect x="13" y="3" width="8" height="8" rx="2" fill="currentColor" opacity="0.4" />
        <rect x="3" y="13" width="8" height="8" rx="2" fill="currentColor" opacity="0.4" />
        <rect x="13" y="13" width="8" height="8" rx="2" fill="currentColor" />
      </svg>
    ),
  },
  {
    href: "/races",
    label: "Schedule",
    icon: (
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="3" y="4" width="18" height="17" rx="3" />
        <path d="M3 9h18M8 2v4M16 2v4" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    href: "/stats",
    label: "Driver Stats",
    icon: (
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none">
        <rect x="4" y="12" width="4" height="8" rx="1" fill="currentColor" opacity="0.5" />
        <rect x="10" y="7" width="4" height="13" rx="1" fill="currentColor" />
        <rect x="16" y="3" width="4" height="17" rx="1" fill="currentColor" opacity="0.75" />
      </svg>
    ),
  },
];

function Brand() {
  return (
    <Link href="/my-leagues" className={styles.brand}>
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
        <path
          d="M4 3v18M4 4h12l-2.5 3L16 10H4"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      </svg>
      Fantasy NASCAR HQ
    </Link>
  );
}

export default function AppShell({
  user,
  children,
}: {
  user: { name?: string | null; email: string };
  children: ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div className={styles.shell}>
      <aside className={styles.sidebar}>
        <Brand />
        <nav className={styles.nav}>
          {NAV_ITEMS.map((item) => {
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={active ? `${styles.navLink} ${styles.navLinkActive}` : styles.navLink}
              >
                <span className={styles.navIcon}>{item.icon}</span>
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
        <div className={styles.footer}>
          <div className={styles.footerName}>{user.name ?? user.email}</div>
          <form action={signOutAction}>
            <button type="submit">Sign out</button>
          </form>
        </div>
      </aside>
      <div className={styles.content}>
        <div className={styles.contentInner}>{children}</div>
      </div>
    </div>
  );
}
