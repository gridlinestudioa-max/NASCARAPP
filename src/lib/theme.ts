import { prisma } from "@/lib/prisma";
import { DEFAULT_THEME, themeToCssVars, type AppTheme, type HeadingFont } from "@/lib/themeVars";

export { DEFAULT_THEME, themeToCssVars };
export type { AppTheme, HeadingFont };

// Single site-wide row — see the AppTheme model for why this isn't
// per-user. Missing row (first run, before any admin edit) falls back to
// the same defaults the Global Style editor starts from.
export async function getAppTheme(): Promise<AppTheme> {
  const row = await prisma.appTheme.findUnique({ where: { id: "singleton" } });
  if (!row) return DEFAULT_THEME;
  return {
    ink: row.ink,
    pageBg: row.pageBg,
    surface: row.surface,
    border: row.border,
    accent: row.accent,
    headingFont: row.headingFont === "Oswald" ? "Oswald" : "Barlow",
    radius: row.radius,
    logoUrl: row.logoUrl,
  };
}
