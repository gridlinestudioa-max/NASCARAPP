import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { auth } from "@/lib/auth";
import AppShell from "@/components/shell/AppShell";
import styles from "@/components/shell/AppShell.module.css";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
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

  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable}`}>
      <body>
        {user?.id ? (
          <AppShell user={{ name: user.name, email: user.email ?? "" }}>{children}</AppShell>
        ) : (
          <div className={styles.authWrap}>
            <div className={styles.authInner}>{children}</div>
          </div>
        )}
      </body>
    </html>
  );
}
