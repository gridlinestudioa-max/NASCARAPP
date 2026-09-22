import Link from "next/link";
import { prisma } from "@/lib/prisma";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import Breadcrumb from "@/components/ui/Breadcrumb";

export const dynamic = "force-dynamic";

export default async function AdminDashboardPage() {
  const season = await prisma.season.findFirst({ orderBy: { year: "desc" } });
  const races = season
    ? await prisma.race.findMany({
        where: { seasonId: season.id },
        orderBy: { week: "asc" },
        include: { _count: { select: { results: true, stageResults: true } } },
      })
    : [];

  return (
    <main>
      <Breadcrumb items={[{ label: "Dashboards" }, { label: "Admin" }]} />
      <h1>Admin</h1>
      <p>
        Schedule, entry lists, qualifying, and results sync automatically from NASCAR. Use a race below only when
        the automatic sync hasn&apos;t caught up yet.
      </p>
      <p>
        <Link href="/admin/historical-import">Historical results import &rarr;</Link>
      </p>

      <Card>
        {races.length === 0 ? (
          <p>No schedule has been set up yet.</p>
        ) : (
          <ul className="rowList">
            {races.map((r) => (
              <li key={r.id}>
                <Link href={`/admin/races/${r.id}`}>
                  Week {r.week} — {r.trackName}
                </Link>
                <span style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
                  {new Date(r.date).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                  <small>
                    {r._count.results} results, {r._count.stageResults} stage
                  </small>
                  {r.isNonPoints && <Badge tone="warning">Non-points</Badge>}
                  {r.status === "COMPLETE" && <Badge tone="success">Final</Badge>}
                  {r.lastSyncedAt && <Badge tone="neutral">Synced</Badge>}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </main>
  );
}
