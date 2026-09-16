import { prisma } from "@/lib/prisma";
import styles from "./page.module.css";

// This queries live data (league/driver counts) — statically prerendering
// it would freeze those numbers at build time instead of reflecting the
// database as it actually is.
export const dynamic = "force-dynamic";

async function getStatus() {
  try {
    const [leagueCount, playerCount] = await Promise.all([
      prisma.league.count(),
      prisma.user.count(),
    ]);
    return { connected: true as const, leagueCount, playerCount };
  } catch (error) {
    return {
      connected: false as const,
      message: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

export default async function Home() {
  const status = await getStatus();

  return (
    <div className={styles.page}>
      <main className={styles.main}>
        <h1>Fantasy NASCAR HQ</h1>
        <p>Pick&apos;em and Tiered Draft leagues, built on Next.js + Prisma.</p>

        {status.connected ? (
          <p>
            Database connected — {status.leagueCount} league(s),{" "}
            {status.playerCount} player(s) on record.
          </p>
        ) : (
          <div>
            <p>Database not connected yet.</p>
            <p>
              Set <code>DATABASE_URL</code> and run{" "}
              <code>npm run db:migrate</code> to apply the schema.
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
