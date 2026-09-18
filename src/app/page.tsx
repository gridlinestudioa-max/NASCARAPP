import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import Card from "@/components/ui/Card";

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
  const [status, session] = await Promise.all([getStatus(), auth()]);

  if (session?.user?.id) {
    return (
      <main>
        <h1>Welcome back{session.user.name ? `, ${session.user.name}` : ""}</h1>
        <Card>
          <p>
            Jump back into <Link href="/my-leagues">My Leagues</Link>, check the{" "}
            <Link href="/races">schedule</Link>, or browse <Link href="/stats">driver stats</Link>.
          </p>
        </Card>
      </main>
    );
  }

  return (
    <main>
      <h1>Fantasy NASCAR HQ</h1>
      <Card>
        <p>Pick&apos;em and Tiered Draft leagues, built for a full field of players.</p>
        <p style={{ marginTop: "var(--space-3)" }}>
          <Link href="/login">Sign in</Link> or <Link href="/signup">create an account</Link>.
        </p>
      </Card>
      <Card title="Status">
        {status.connected ? (
          <p>
            Database connected — {status.leagueCount} league(s), {status.playerCount} player(s) on record.
          </p>
        ) : (
          <div>
            <p>Database not connected yet.</p>
            <p>
              Set <code>DATABASE_URL</code> and run <code>npm run db:migrate</code> to apply the schema.
            </p>
          </div>
        )}
      </Card>
    </main>
  );
}
