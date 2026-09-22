import type { Metadata } from "next";
import { Geist_Mono, Inter, Barlow } from "next/font/google";
import { auth } from "@/lib/auth";
import { isSiteAdmin } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
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

  const leagues = user?.id
    ? (
        await prisma.leagueMembership.findMany({
          where: { userId: user.id },
          include: { league: { select: { id: true, name: true } } },
          orderBy: { league: { name: "asc" } },
        })
      ).map((m) => ({ id: m.league.id, name: m.league.name }))
    : [];

  return (
    <html lang="en" className={`${inter.variable} ${barlow.variable} ${geistMono.variable}`}>
      <body>
        {user?.id ? (
          <AppShell user={{ name: user.name, email: user.email ?? "" }} isAdmin={isSiteAdmin(user.email)} leagues={leagues}>
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
