import type { CSSProperties } from "react";
import type { Metadata } from "next";
import { Geist_Mono, Inter, Barlow, Oswald } from "next/font/google";
import { auth } from "@/lib/auth";
import { isSiteAdmin } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { getAppTheme, themeToCssVars } from "@/lib/theme";
import AppShell from "@/components/shell/AppShell";
import styles from "@/components/shell/AppShell.module.css";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  weight: ["400", "500", "600", "700", "800"],
  subsets: ["latin"],
});

const barlow = Barlow({
  variable: "--font-barlow",
  weight: ["600", "700", "800", "900"],
  subsets: ["latin"],
});

const oswald = Oswald({
  variable: "--font-oswald",
  weight: ["600", "700"],
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Fantasy NASCAR HQ",
  description: "Pick'em and Tiered Draft fantasy NASCAR leagues.",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const session = await auth();
  const user = session?.user;

  const [leagues, theme] = await Promise.all([
    user?.id
      ? prisma.leagueMembership
          .findMany({
            where: { userId: user.id },
            include: { league: { select: { id: true, name: true, iconUrl: true } } },
            orderBy: { league: { name: "asc" } },
          })
          .then((rows) =>
            rows.map((m) => ({ id: m.league.id, name: m.league.name, color: m.color, iconUrl: m.league.iconUrl })),
          )
      : Promise.resolve([]),
    getAppTheme(),
  ]);

  const themeVars = themeToCssVars(theme);

  return (
    <html
      lang="en"
      className={`${inter.variable} ${barlow.variable} ${oswald.variable} ${geistMono.variable}`}
      style={themeVars as CSSProperties}
      suppressHydrationWarning
    >
      <head>
        {/* Sets data-theme before hydration so dark mode never flashes light
            first — a plain inline script is the standard way to read a
            client-only preference (localStorage) ahead of paint; this
            string is fixed and owned by us, not user input. */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              "try{if(localStorage.getItem('colorMode')==='dark'){document.documentElement.setAttribute('data-theme','dark');}}catch(e){}",
          }}
        />
      </head>
      <body>
        {user?.id ? (
          <AppShell
            user={{ name: user.name, email: user.email ?? "" }}
            isAdmin={isSiteAdmin(user.email)}
            leagues={leagues}
            logoUrl={theme.logoUrl}
          >
            {children}
          </AppShell>
        ) : (
          <div className={styles.authWrap}>
            <div className={styles.authInner}>{children}</div>
          </div>
        )}
      </body>
    </html>
  );
}
