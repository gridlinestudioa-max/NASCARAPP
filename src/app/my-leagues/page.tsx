import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import Breadcrumb from "@/components/ui/Breadcrumb";
import styles from "./page.module.css";

export const dynamic = "force-dynamic";

export default async function MyLeaguesPage() {
  const session = await auth();
  // Also guards against a stale session predating a session-shape change
  // (e.g. before user.id was added to the token) — without this, a
  // missing id would silently drop the where-filter below instead of
  // matching nothing.
  if (!session?.user?.id) {
    redirect("/login");
  }

  const memberships = await prisma.leagueMembership.findMany({
    where: { userId: session.user.id },
    include: { league: true },
    orderBy: { league: { name: "asc" } },
  });

  return (
    <main>
      <Breadcrumb items={[{ label: "Dashboards" }, { label: "My Leagues" }]} />
      <h1>My Leagues</h1>

      <Card
        title="Your Leagues"
        actions={
          <>
            <Link href="/leagues/new" className="linkButton">
              Create a league
            </Link>
            <Link href="/leagues/join" className="linkButtonOutline">
              Join with code
            </Link>
          </>
        }
      >
        {memberships.length === 0 ? (
          <p>You&apos;re not in any leagues yet.</p>
        ) : (
          <ul className="rowList">
            {memberships.map((m) => (
              <li key={m.id}>
                <Link href={`/leagues/${m.league.id}`}>
                  <span className={styles.leagueRow}>
                    <span className={styles.avatar}>{m.league.name.charAt(0).toUpperCase()}</span>
                    <span className={styles.leagueName}>{m.league.name}</span>
                    {m.role === "OWNER" && <Badge tone="neutral">Commish</Badge>}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </main>
  );
}
