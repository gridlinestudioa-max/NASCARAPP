// Pure theme helpers with no server-only imports (no Prisma) — safe to use
// from a client component for the Global Style page's live preview. See
// src/lib/theme.ts for the server-side loader that wraps these.

export type HeadingFont = "Barlow" | "Oswald";
export type AppTheme = {
  ink: string;
  pageBg: string;
  surface: string;
  border: string;
  accent: string;
  headingFont: HeadingFont;
  radius: number;
};

export const DEFAULT_THEME: AppTheme = {
  ink: "#2e2e2e",
  pageBg: "#ffffff",
  surface: "#f7f7f7",
  border: "#e3e3e3",
  accent: "#000000",
  headingFont: "Barlow",
  radius: 14,
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
    "--muted": `color-mix(in oklab, ${theme.ink} 70%, ${theme.pageBg})`,
    "--faint": `color-mix(in oklab, ${theme.ink} 48%, ${theme.pageBg})`,
    "--heading-font-name": theme.headingFont === "Oswald" ? "var(--font-oswald)" : "var(--font-barlow)",
    "--radius": `${theme.radius}px`,
    "--shellRadius": `max(0px, calc(${theme.radius}px - 4px))`,
  };
}
