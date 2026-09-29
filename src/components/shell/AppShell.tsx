"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { signOutAction } from "@/app/actions";
import { LayoutDashboard } from "@/components/animate-ui/icons/layout-dashboard";
import { BetweenHorizontalStart } from "@/components/animate-ui/icons/between-horizontal-start";
import { SignalHigh } from "@/components/animate-ui/icons/signal-high";
import { LockKeyhole } from "@/components/animate-ui/icons/lock-keyhole";
import { PanelLeftOpen } from "@/components/animate-ui/icons/panel-left-open";
import styles from "./AppShell.module.css";

const ESSENTIAL_NAV_ITEMS = [
  {
    href: "/",
    label: "Home",
    icon: <LayoutDashboard size={16} animateOnHover />,
  },
  {
    href: "/races",
    label: "Schedule",
    icon: <BetweenHorizontalStart size={16} animateOnHover />,
  },
  {
    href: "/stats",
    label: "Driver Stats",
    icon: <SignalHigh size={16} animateOnHover />,
  },
];

const ADMIN_NAV_ITEM = {
  href: "/admin",
  label: "Admin",
  icon: <LockKeyhole size={16} animateOnHover />,
};

const SETTINGS_ICON = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={styles.gearIcon}>
    <circle cx="12" cy="12" r="3" />
    <path
      d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const SIGN_OUT_ICON = <PanelLeftOpen size={15} animateOnHover />;

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

const LEAGUES_ICON = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M7 4h10v4a5 5 0 0 1-10 0V4z" strokeLinecap="round" strokeLinejoin="round" />
    <path
      d="M7 5H4a1 1 0 0 0-1 1v1a4 4 0 0 0 4 4M17 5h3a1 1 0 0 1 1 1v1a4 4 0 0 1-4 4"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path d="M8 21h8M12 17v4" strokeLinecap="round" />
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
  const expanded = hovered;

  // Mobile only: which bottom sheet (if any) is open. The bottom bar
  // itself never changes shape — unlike the old hamburger dropdown, tabs
  // stay put; only a panel slides up above them. At most one open at a
  // time, so a single nullable field (not two booleans) is the honest
  // model of the state.
  const [mobileSheet, setMobileSheet] = useState<"leagues" | "more" | null>(null);

  // Close the sheet after a navigation completes — it has no other way to
  // close itself once a link inside it is tapped. This resets menu UI in
  // response to a route change rather than deriving render output from
  // props/state, so a plain effect (not useMemo) is the right tool; React
  // bails out of the re-render itself when the value is already null.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMobileSheet(null);
  }, [pathname]);

  useEffect(() => {
    if (!mobileSheet) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setMobileSheet(null);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [mobileSheet]);

  const activeLeagueId = pathname.match(/^\/leagues\/([^/]+)/)?.[1];
  const displayName = user.name ?? user.email;

  return (
    <div className={styles.shell}>
      <div className={styles.sidebarSlot}>
        <aside
          className={styles.sidebar}
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
          <Link
            href="/"
            className={styles.brandRow}
            style={{ justifyContent: expanded ? "flex-start" : "center" }}
          >
            {logoUrl ? (
              <span className={styles.brandMark}>
                {/* eslint-disable-next-line @next/next/no-img-element -- admin-pasted URL, not a static/local asset */}
                <img src={logoUrl} alt="" className={styles.brandMarkImg} />
              </span>
            ) : expanded ? (
              // The full FindTheGroove wordmark already spells out the
              // name, so there's no separate brandName text to pair it
              // with — showing the compact oval mark *and* the wordmark
              // side by side would just say "FTG FindTheGroove" twice.
              // Both theme variants render; CSS (see brandLogoDark/Light)
              // shows only the one matching the live data-theme, same
              // swap pattern as the mark below.
              <span className={styles.brandWordmarkWrap}>
                {/* eslint-disable-next-line @next/next/no-img-element -- bundled brand asset, not photographic content next/image needs to optimize */}
                <img
                  src="/brand/ftg-wordmark-dark.svg"
                  alt="FindTheGroove"
                  className={`${styles.brandWordmark} ${styles.brandLogoDark}`}
                />
                {/* eslint-disable-next-line @next/next/no-img-element -- bundled brand asset, not photographic content next/image needs to optimize */}
                <img
                  src="/brand/ftg-wordmark-light.svg"
                  alt="FindTheGroove"
                  className={`${styles.brandWordmark} ${styles.brandLogoLight}`}
                />
              </span>
            ) : (
              <span className={styles.brandLogoMark}>
                {/* eslint-disable-next-line @next/next/no-img-element -- bundled brand asset, not photographic content next/image needs to optimize */}
                <img
                  src="/brand/ftg-mark-dark.svg"
                  alt="FindTheGroove"
                  className={`${styles.brandLogoImg} ${styles.brandLogoDark}`}
                />
                {/* eslint-disable-next-line @next/next/no-img-element -- bundled brand asset, not photographic content next/image needs to optimize */}
                <img
                  src="/brand/ftg-mark-light.svg"
                  alt="FindTheGroove"
                  className={`${styles.brandLogoImg} ${styles.brandLogoLight}`}
                />
              </span>
            )}
          </Link>

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

      {/* Mobile only (see AppShell.module.css) — a fixed bottom tab bar
          that never itself changes shape, per the "real app" reference:
          Home/Schedule/Stats are direct links; Leagues/More each open a
          sheet that slides up above the bar, closed by its own backdrop,
          Escape, or navigating. */}
      <nav className={styles.bottomBar} aria-label="Primary">
        {ESSENTIAL_NAV_ITEMS.map((item) => {
          // A sheet being open takes over the active look entirely (see
          // reference) — Home shouldn't still read as active while the
          // More sheet is up over it.
          const active = isActivePath(pathname, item.href) && !activeLeagueId && !mobileSheet;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={active ? `${styles.bottomBarItem} ${styles.bottomBarItemActive}` : styles.bottomBarItem}
            >
              <span className={styles.bottomBarIcon}>{item.icon}</span>
              <span className={styles.bottomBarLabel}>{item.label === "Driver Stats" ? "Stats" : item.label}</span>
            </Link>
          );
        })}
        {/* Leagues/More take the same active look (icon/label lit up, bar
            above) whenever their own sheet is open — not tied to a route,
            since opening the sheet is itself "being on that tab". */}
        <button
          type="button"
          className={
            mobileSheet === "leagues" ? `${styles.bottomBarItem} ${styles.bottomBarItemActive}` : styles.bottomBarItem
          }
          onClick={() => setMobileSheet((s) => (s === "leagues" ? null : "leagues"))}
          aria-expanded={mobileSheet === "leagues"}
        >
          <span className={styles.bottomBarIcon}>{LEAGUES_ICON}</span>
          <span className={styles.bottomBarLabel}>Leagues</span>
        </button>
        <button
          type="button"
          className={
            mobileSheet === "more" ? `${styles.bottomBarItem} ${styles.bottomBarItemActive}` : styles.bottomBarItem
          }
          onClick={() => setMobileSheet((s) => (s === "more" ? null : "more"))}
          aria-expanded={mobileSheet === "more"}
        >
          <span className={styles.bottomBarIcon}>{MENU_ICON}</span>
          <span className={styles.bottomBarLabel}>More</span>
        </button>
      </nav>

      {mobileSheet && (
        <div className={styles.mobileBackdrop} onClick={() => setMobileSheet(null)} aria-hidden="true" />
      )}

      {mobileSheet === "leagues" && (
        <div className={styles.bottomSheet} role="dialog" aria-label="Leagues">
          <div className={styles.bottomSheetHeader}>
            <span className={styles.sectionLabel}>Leagues</span>
            <div className={styles.bottomSheetHeaderActions}>
              <Link href="/leagues/new" className={styles.sectionAction} aria-label="Create a league" title="Create a league">
                {ADD_ICON}
              </Link>
              <button type="button" className={styles.sheetCloseButton} onClick={() => setMobileSheet(null)} aria-label="Close">
                {CLOSE_ICON}
              </button>
            </div>
          </div>
          {leagues.length === 0 ? (
            <p className={styles.sheetEmpty}>You&apos;re not in any leagues yet.</p>
          ) : (
            <div className={styles.sheetGrid}>
              {leagues.map((league, i) => {
                const active = league.id === activeLeagueId;
                return (
                  <Link
                    key={league.id}
                    href={`/leagues/${league.id}`}
                    className={active ? `${styles.sheetCard} ${styles.sheetCardActive}` : styles.sheetCard}
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
                    <span className={styles.sheetCardLabel}>{league.name}</span>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      )}

      {mobileSheet === "more" && (
        <div className={styles.bottomSheet} role="dialog" aria-label="More">
          <div className={styles.bottomSheetHeader}>
            <span className={styles.sectionLabel}>More</span>
            <button type="button" className={styles.sheetCloseButton} onClick={() => setMobileSheet(null)} aria-label="Close">
              {CLOSE_ICON}
            </button>
          </div>
          <div className={styles.sheetGrid}>
            {isAdmin && (
              <Link
                href={ADMIN_NAV_ITEM.href}
                className={
                  isActivePath(pathname, ADMIN_NAV_ITEM.href)
                    ? `${styles.sheetCard} ${styles.sheetCardActive}`
                    : styles.sheetCard
                }
              >
                <span className={styles.sheetCardIcon}>{ADMIN_NAV_ITEM.icon}</span>
                <span className={styles.sheetCardLabel}>{ADMIN_NAV_ITEM.label}</span>
              </Link>
            )}
            <Link href="/settings" className={styles.sheetCard}>
              <span className={styles.sheetCardIcon}>{SETTINGS_ICON}</span>
              <span className={styles.sheetCardLabel}>Settings</span>
            </Link>
          </div>
          <div className={styles.userRow} style={{ justifyContent: "flex-start" }}>
            <span className={styles.avatar}>
              {user.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element -- arbitrary uploaded Vercel Blob URL, not a static/local asset
                <img src={user.avatarUrl} alt="" className={styles.avatarImg} />
              ) : (
                (displayName || "?").charAt(0).toUpperCase()
              )}
            </span>
            <span className={styles.userInfo}>
              <span className={styles.userName}>{displayName}</span>
            </span>
            <form action={signOutAction}>
              <button type="submit" className={styles.signOutButton} aria-label="Sign out" title="Sign out">
                {SIGN_OUT_ICON}
              </button>
            </form>
          </div>
        </div>
      )}

      <div className={styles.content}>
        <div className={styles.contentInner}>
          {/* The sidebar (which carries the brand mark/wordmark on every
              other viewport) is hidden entirely on mobile in favor of the
              fixed bottom tab bar — without this, the site's own logo
              never appeared anywhere on a phone. Shown only under the
              mobile breakpoint (see .mobileBrandRow); desktop keeps
              getting its brand from the sidebar only, not this too. */}
          <Link href="/" className={styles.mobileBrandRow}>
            <span className={styles.mobileBrandMarkWrap}>
              {/* eslint-disable-next-line @next/next/no-img-element -- bundled brand asset, not photographic content next/image needs to optimize */}
              <img
                src="/brand/ftg-mark-dark.svg"
                alt=""
                className={`${styles.mobileBrandMark} ${styles.brandLogoDark}`}
              />
              {/* eslint-disable-next-line @next/next/no-img-element -- bundled brand asset, not photographic content next/image needs to optimize */}
              <img
                src="/brand/ftg-mark-light.svg"
                alt=""
                className={`${styles.mobileBrandMark} ${styles.brandLogoLight}`}
              />
            </span>
            {/* eslint-disable-next-line @next/next/no-img-element -- bundled brand asset, not photographic content next/image needs to optimize */}
            <img
              src="/brand/ftg-wordmark-dark.svg"
              alt="FindTheGroove"
              className={`${styles.mobileBrandWordmark} ${styles.brandLogoDark}`}
            />
            {/* eslint-disable-next-line @next/next/no-img-element -- bundled brand asset, not photographic content next/image needs to optimize */}
            <img
              src="/brand/ftg-wordmark-light.svg"
              alt="FindTheGroove"
              className={`${styles.mobileBrandWordmark} ${styles.brandLogoLight}`}
            />
          </Link>
          {children}
        </div>
      </div>
    </div>
  );
}
