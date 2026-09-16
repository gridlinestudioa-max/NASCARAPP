import { prisma } from "@/lib/prisma";
import styles from "./page.module.css";

async function getStatus() {
  try {
    const [leagueCount, driverCount] = await Promise.all([
      prisma.league.count(),
      prisma.driver.count(),
    ]);
    return { connected: true as const, leagueCount, driverCount };
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
            {status.driverCount} driver(s) on record.
          </p>
        ) : (
          <div>
            <p>Database not connected yet.</p>
            <p>
              Set <code>DATABASE_URL</code> and run{" "}
              <code>npm run db:migrate</code> to apply the schema.
            </p>
            <p style={{ fontFamily: "monospace", fontSize: "0.85em" }}>
              {status.message}
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
