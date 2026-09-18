import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ownsALeagueInSeason } from "@/lib/authz";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import SyncScheduleButton from "./SyncScheduleButton";

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
  const canSyncSchedule = season ? await ownsALeagueInSeason(session.user.id, season.id) : false;

  return (
    <main>
      <h1>Schedule</h1>
      {season && <p>{season.year} season</p>}

      {season && canSyncSchedule && (
        <Card title="Commissioner tools">
          <SyncScheduleButton seasonId={season.id} />
        </Card>
      )}

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
