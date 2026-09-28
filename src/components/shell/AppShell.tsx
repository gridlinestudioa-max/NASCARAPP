"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
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

const MENU_ICON = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M3 6h18M3 12h18M3 18h18" strokeLinecap="round" />
  </svg>
);

const CLOSE_ICON = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
  </svg>
);

// var(--dot-N), not literal hex — a league with no explicit color (see
// leagueColors.ts) falls back to this neutral grayscale rotation, and
// unlike LEAGUE_COLOR_SWATCHES's saturated picks, #141414 read as
// essentially invisible against the dark theme's #121212 sidebar. Themed
// in globals.css the same way --text-accent is, instead of literal hex.
const DOT_COLORS = ["var(--dot-1)", "var(--dot-2)", "var(--dot-3)", "var(--dot-4)"];

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
  user: { name?: string | null; email: string; avatarUrl?: string | null };
  isAdmin: boolean;
  leagues: { id: string; name: string; color: string | null; iconUrl: string | null }[];
  logoUrl?: string | null;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const [hovered, setHovered] = useState(false);
  // Touch devices never fire the hover events above, which is exactly why
  // the mobile nav used to be an unlabeled icon strip — mobileMenuOpen is a
  // separate, tap-driven trigger for the same "expanded" (labels showing)
  // layout, opening it as a dropdown panel instead of a hover-widened rail.
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const expanded = hovered || mobileMenuOpen;

  // Close the dropdown after a navigation completes — it has no other way
  // to close itself once a link inside it is tapped. This resets menu UI
  // in response to a route change rather than deriving render output from
  // props/state, so a plain effect (not useMemo) is the right tool; React
  // bails out of the re-render itself when the value is already false.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMobileMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!mobileMenuOpen) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setMobileMenuOpen(false);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [mobileMenuOpen]);

  const activeLeagueId = pathname.match(/^\/leagues\/([^/]+)/)?.[1];
  const displayName = user.name ?? user.email;

  return (
    <div className={styles.shell}>
      {/* Mobile only (see AppShell.module.css) — dims the page and closes
          the dropdown on an outside tap, same as any standard menu. */}
      {mobileMenuOpen && (
        <div className={styles.mobileBackdrop} onClick={() => setMobileMenuOpen(false)} aria-hidden="true" />
      )}
      <div className={styles.sidebarSlot}>
        <aside
          className={mobileMenuOpen ? `${styles.sidebar} ${styles.mobileOpen}` : styles.sidebar}
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
          style={{
            width: hovered ? "240px" : "72px",
            padding: hovered ? "20px 16px" : "20px 12px",
            boxShadow: hovered
              ? "0 24px 60px -12px rgba(0,0,0,0.35), 0 2px 8px rgba(0,0,0,0.15)"
              : "0 20px 40px -14px rgba(0,0,0,0.3), 0 1px 4px rgba(0,0,0,0.1)",
          }}
        >
          {/* Its own row-flex, independent of .sidebar's own flex-direction
              (column once open on mobile) — brand + toggle stay side by
              side as a header, with everything else stacking below them. */}
          <div className={styles.mobileTopRow}>
            <Link
              href="/"
              className={styles.brandRow}
              style={{ justifyContent: expanded ? "flex-start" : "center" }}
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
              {expanded && (
                <span className={styles.brandText}>
                  <span className={styles.brandName}>Fantasy NASCAR HQ</span>
                </span>
              )}
            </Link>

            <button
              type="button"
              className={styles.mobileMenuButton}
              onClick={() => setMobileMenuOpen((open) => !open)}
              aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
              aria-expanded={mobileMenuOpen}
            >
              {mobileMenuOpen ? CLOSE_ICON : MENU_ICON}
            </button>
          </div>

          {expanded && <div className={styles.sectionLabel}>Essentials</div>}
          <nav className={styles.navGroup}>
            {ESSENTIAL_NAV_ITEMS.map((item) => {
              const active = isActivePath(pathname, item.href) && !activeLeagueId;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={active ? `${styles.navLink} ${styles.navLinkActive}` : styles.navLink}
                  style={{ justifyContent: expanded ? "flex-start" : "center" }}
                >
                  <span className={styles.navIcon}>{item.icon}</span>
                  {expanded && <span className={styles.navLabel}>{item.label}</span>}
                </Link>
              );
            })}
          </nav>

          {expanded && (
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
                  style={{ justifyContent: expanded ? "flex-start" : "center" }}
                >
                  {league.iconUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element -- commissioner-pasted URL, not a static/local asset
                    <img src={league.iconUrl} alt="" className={styles.leagueIcon} />
                  ) : (
                    <span
                      className={styles.leagueDot}
                      style={{ background: league.color ?? DOT_COLORS[i % DOT_COLORS.length] }}
                    />
                  )}
                  {expanded && <span className={styles.navLabel}>{league.name}</span>}
                </Link>
              );
            })}
          </nav>

          {expanded && <div className={styles.sectionLabel}>Support</div>}
          <nav className={styles.navGroup}>
            {isAdmin && (
              <Link
                href={ADMIN_NAV_ITEM.href}
                className={
                  isActivePath(pathname, ADMIN_NAV_ITEM.href)
                    ? `${styles.navLink} ${styles.navLinkActive}`
                    : styles.navLink
                }
                style={{ justifyContent: expanded ? "flex-start" : "center" }}
              >
                <span className={styles.navIcon}>{ADMIN_NAV_ITEM.icon}</span>
                {expanded && <span className={styles.navLabel}>{ADMIN_NAV_ITEM.label}</span>}
              </Link>
            )}
            <Link
              href="/settings"
              className={styles.settingsToggle}
              style={{ justifyContent: expanded ? "flex-start" : "center" }}
            >
              <span className={styles.navIcon}>{SETTINGS_ICON}</span>
              {expanded && <span className={styles.navLabel}>Settings</span>}
            </Link>
          </nav>

          <div className={styles.userRow} style={{ justifyContent: expanded ? "flex-start" : "center" }}>
            <span className={styles.avatar}>
              {user.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element -- arbitrary uploaded Vercel Blob URL, not a static/local asset
                <img src={user.avatarUrl} alt="" className={styles.avatarImg} />
              ) : (
                (displayName || "?").charAt(0).toUpperCase()
              )}
            </span>
            {expanded && (
              <>
                <span className={styles.userInfo}>
                  <span className={styles.userName}>{displayName}</span>
                </span>
                <form action={signOutAction}>
                  <button type="submit" className={styles.signOutButton} aria-label="Sign out" title="Sign out">
                    {SIGN_OUT_ICON}
                  </button>
                </form>
              </>
            )}
          </div>
        </aside>
      </div>
      <div className={styles.content}>
        <div className={styles.contentInner}>{children}</div>
      </div>
    </div>
  );
}
