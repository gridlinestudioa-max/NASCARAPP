import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import Breadcrumb from "@/components/ui/Breadcrumb";

export const dynamic = "force-dynamic";

export default async function SchedulePage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const season = await prisma.season.findFirst({ orderBy: { year: "desc" } });
  const races = season
    ? await prisma.race.findMany({ where: { seasonId: season.id }, orderBy: { week: "asc" } })
    : [];

  return (
    <main>
      <Breadcrumb items={[{ label: "Dashboards" }, { label: "Schedule" }]} />
      <h1>Schedule</h1>
      {season && <p>{season.year} season</p>}

      <Card>
        {races.length === 0 ? (
          <p>No schedule has been set up yet.</p>
        ) : (
          <ul className="rowList">
            {races.map((r) => (
              <li key={r.id}>
                <Link href={`/races/${r.id}`}>
                  Week {r.week} — {r.trackName}
                </Link>
                <span style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
                  {new Date(r.date).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                  {r.status === "COMPLETE" && <Badge tone="success">Final</Badge>}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </main>
  );
}
