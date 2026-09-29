// Pure theme helpers with no server-only imports (no Prisma) — safe to use
// from a client component for the Global Style page's live preview. See
// src/lib/theme.ts for the server-side loader that wraps these.

export type HeadingFont = "Barlow" | "Oswald" | "BigShoulders";
export type AppTheme = {
  ink: string;
  pageBg: string;
  surface: string;
  border: string;
  accent: string;
  headingFont: HeadingFont;
  radius: number;
  // App-wide logo shown in the sidebar brand mark, in place of the default
  // placeholder mark. Not a CSS var (see themeToCssVars) — a component
  // renders it directly. Nullable: no real brand asset exists yet.
  logoUrl: string | null;
};

// "Night Race Broadcast" — the site's default look as of the full-site
// reskin: near-black ground, a raised-navy "ink" (used for solid chip
// fills — avatars, badges, the sidebar brand mark), flag-yellow accent,
// zero radius (the square-cornered, slanted-edge shape language lives in
// globals.css's fixed --radius-sm/-btn/-pill and the --slant-8 clip-path,
// not here). Still fully admin-editable from /admin/style — this is a
// starting point, not a hardcoded look.
export const DEFAULT_THEME: AppTheme = {
  ink: "#1e232e",
  pageBg: "#0b0d12",
  surface: "#12151c",
  border: "#262b36",
  accent: "#ffd400",
  headingFont: "BigShoulders",
  radius: 0,
  logoUrl: null,
};

// CSS custom properties for the root theme knobs, plus every derived value
// the app's stylesheets key off of. Used both server-side (inlined on
// <html> in the root layout, so there's no flash) and client-side (the
// Global Style editor sets these directly on document.documentElement for
// an instant, full-app live preview while an admin drags a control,
// ahead of the server action's revalidate finishing).
export function themeToCssVars(theme: AppTheme): Record<string, string> {
  return {
    "--ink": theme.ink,
    "--pageBg": theme.pageBg,
    "--surface": theme.surface,
    "--border": theme.border,
    "--accent": theme.accent,
    // Both directions of mix flipped from the original light-theme-only
    // assumption (mixing a dark "ink" toward a light "pageBg" to get a
    // muted gray only works when pageBg actually is the lighter of the
    // two) — --text-primary is its own knob-independent readable color
    // now (see globals.css's :root), so muted/faint mix that toward
    // pageBg instead of ink, which stays correct whichever way the admin
    // sets pageBg/ink relative to each other.
    "--muted": `color-mix(in oklab, var(--text-primary) 70%, ${theme.pageBg})`,
    "--faint": `color-mix(in oklab, var(--text-primary) 48%, ${theme.pageBg})`,
    "--heading-font-name":
      theme.headingFont === "Oswald"
        ? "var(--font-oswald)"
        : theme.headingFont === "BigShoulders"
          ? "var(--font-big-shoulders)"
          : "var(--font-barlow)",
    "--radius": `${theme.radius}px`,
    "--shellRadius": `max(0px, calc(${theme.radius}px - 4px))`,
  };
}
