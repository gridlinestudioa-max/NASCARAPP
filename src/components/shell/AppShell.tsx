"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import { signOutAction } from "@/app/actions";
import styles from "./AppShell.module.css";

const ESSENTIAL_NAV_ITEMS = [
  {
    href: "/",
    label: "Home",
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M3 11l9-8 9 8" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M5 10v10h14V10" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    href: "/races",
    label: "Schedule",
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="3" y="4" width="18" height="17" rx="3" />
        <path d="M3 9h18M8 2v4M16 2v4" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    href: "/stats",
    label: "Driver Stats",
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
        <rect x="4" y="12" width="4" height="8" rx="1" fill="currentColor" opacity="0.5" />
        <rect x="10" y="7" width="4" height="13" rx="1" fill="currentColor" />
        <rect x="16" y="3" width="4" height="17" rx="1" fill="currentColor" opacity="0.75" />
      </svg>
    ),
  },
];

const ADMIN_NAV_ITEM = {
  href: "/admin",
  label: "Admin",
  icon: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 2l7 3v6c0 5-3 8-7 9-4-1-7-4-7-9V5l7-3z" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
};

const SETTINGS_ICON = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="12" cy="12" r="3" />
    <path
      d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const SIGN_OUT_ICON = (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M16 17l5-5-5-5M21 12H9" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const ADD_ICON = (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M12 5v14M5 12h14" strokeLinecap="round" />
  </svg>
);

const DOT_COLORS = ["#141414", "#6b6b6b", "#9a9a97", "#c7c6c0"];

function isActivePath(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export default function AppShell({
  user,
  isAdmin,
  leagues,
  logoUrl,
  children,
}: {
  user: { name?: string | null; email: string };
  isAdmin: boolean;
  leagues: { id: string; name: string; color: string | null }[];
  logoUrl?: string | null;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const [hovered, setHovered] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const activeLeagueId = pathname.match(/^\/leagues\/([^/]+)/)?.[1];
  const displayName = user.name ?? user.email;

  return (
    <div className={styles.shell}>
      <div className={styles.sidebarSlot}>
        <aside
          className={styles.sidebar}
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => {
            setHovered(false);
            setSettingsOpen(false);
          }}
          style={{
            width: hovered ? "240px" : "72px",
            padding: hovered ? "20px 16px" : "20px 12px",
            boxShadow: hovered
              ? "0 24px 60px -12px rgba(0,0,0,0.35), 0 2px 8px rgba(0,0,0,0.15)"
              : "0 20px 40px -14px rgba(0,0,0,0.3), 0 1px 4px rgba(0,0,0,0.1)",
          }}
        >
          <Link
            href="/"
            className={styles.brandRow}
            style={{ justifyContent: hovered ? "flex-start" : "center" }}
          >
            <span className={styles.brandMark}>
              {logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element -- admin-pasted URL, not a static/local asset
                <img src={logoUrl} alt="" className={styles.brandMarkImg} />
              ) : (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                  <path
                    d="M4 3v18M4 4h12l-2.5 3L16 10H4"
                    stroke="#ffffff"
                    strokeWidth="2"
                    strokeLinejoin="round"
                    strokeLinecap="round"
                  />
                </svg>
              )}
            </span>
            {hovered && (
              <span className={styles.brandText}>
                <span className={styles.brandName}>Fantasy NASCAR HQ</span>
                <span className={styles.brandUser}>{displayName}</span>
              </span>
            )}
          </Link>

          {hovered && <div className={styles.sectionLabel}>Essentials</div>}
          <nav className={styles.navGroup}>
            {ESSENTIAL_NAV_ITEMS.map((item) => {
              const active = isActivePath(pathname, item.href) && !activeLeagueId;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={active ? `${styles.navLink} ${styles.navLinkActive}` : styles.navLink}
                  style={{ justifyContent: hovered ? "flex-start" : "center" }}
                >
                  <span className={styles.navIcon}>{item.icon}</span>
                  {hovered && <span className={styles.navLabel}>{item.label}</span>}
                </Link>
              );
            })}
          </nav>

          {hovered && (
            <div className={styles.sectionRow}>
              <span className={styles.sectionLabel}>Leagues</span>
              <Link href="/leagues/new" className={styles.sectionAction} aria-label="Create a league" title="Create a league">
                {ADD_ICON}
              </Link>
            </div>
          )}
          <nav className={styles.navGroup}>
            {leagues.map((league, i) => {
              const active = league.id === activeLeagueId;
              return (
                <Link
                  key={league.id}
                  href={`/leagues/${league.id}`}
                  className={active ? `${styles.navLink} ${styles.navLinkActive}` : styles.navLink}
                  style={{ justifyContent: hovered ? "flex-start" : "center" }}
                >
                  <span
                    className={styles.leagueDot}
                    style={{ background: league.color ?? DOT_COLORS[i % DOT_COLORS.length] }}
                  />
                  {hovered && <span className={styles.navLabel}>{league.name}</span>}
                </Link>
              );
            })}
          </nav>

          {hovered && <div className={styles.sectionLabel}>Support</div>}
          <nav className={styles.navGroup}>
            {isAdmin && (
              <Link
                href={ADMIN_NAV_ITEM.href}
                className={
                  isActivePath(pathname, ADMIN_NAV_ITEM.href)
                    ? `${styles.navLink} ${styles.navLinkActive}`
                    : styles.navLink
                }
                style={{ justifyContent: hovered ? "flex-start" : "center" }}
              >
                <span className={styles.navIcon}>{ADMIN_NAV_ITEM.icon}</span>
                {hovered && <span className={styles.navLabel}>{ADMIN_NAV_ITEM.label}</span>}
              </Link>
            )}
            <button
              type="button"
              onClick={() => setSettingsOpen((open) => !open)}
              className={settingsOpen ? `${styles.settingsToggle} ${styles.settingsToggleOpen}` : styles.settingsToggle}
              style={{ justifyContent: hovered ? "flex-start" : "center" }}
            >
              <span className={styles.navIcon}>{SETTINGS_ICON}</span>
              {hovered && <span className={styles.navLabel}>Settings</span>}
            </button>
            {settingsOpen && (
              <div className={styles.settingsPanel}>
                {isAdmin && (
                  <Link href="/admin/style" className={styles.settingsPanelLink}>
                    Edit global style →
                  </Link>
                )}
                <Link href="/settings" className={styles.settingsPanelLink}>
                  Account settings →
                </Link>
              </div>
            )}
          </nav>

          <div className={styles.userRow} style={{ justifyContent: hovered ? "flex-start" : "center" }}>
            <span className={styles.avatar}>{(displayName || "?").charAt(0).toUpperCase()}</span>
            {hovered && (
              <>
                <span className={styles.userInfo}>
                  <span className={styles.userName}>{displayName}</span>
                  <span className={styles.userRole}>{isAdmin ? "Commissioner" : "Member"}</span>
                </span>
                <form action={signOutAction}>
                  <button type="submit" className={styles.signOutButton} aria-label="Sign out" title="Sign out">
                    {SIGN_OUT_ICON}
                  </button>
                </form>
              </>
            )}
            {/* Always rendered (not gated on hover) so sign-out stays reachable on
                touch devices, which never trigger the desktop hover-expand state. */}
            <form action={signOutAction} className={styles.mobileSignOut}>
              <button type="submit" aria-label="Sign out" title="Sign out">
                {SIGN_OUT_ICON}
              </button>
            </form>
          </div>
        </aside>
      </div>
      <div className={styles.content}>
        <div className={styles.contentInner}>{children}</div>
      </div>
    </div>
  );
}
