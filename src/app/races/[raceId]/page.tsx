import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ownsALeagueInSeason } from "@/lib/authz";
import Card from "@/components/ui/Card";
import SyncFromNascarButton from "./SyncFromNascarButton";

export const dynamic = "force-dynamic";

export default async function RacePage(props: PageProps<"/races/[raceId]">) {
  const { raceId } = await props.params;

  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const race = await prisma.race.findUnique({
    where: { id: raceId },
    include: { season: true, results: { include: { driver: true }, orderBy: { finishingPosition: "asc" } } },
  });
  if (!race) {
    notFound();
  }

  const canEnterResults = await ownsALeagueInSeason(session.user.id, race.seasonId);

  return (
    <main>
      <p>
        <Link href="/races">&larr; Schedule</Link>
      </p>
      <h1>
        Week {race.week} — {race.trackName}
      </h1>
      <p>
        {new Date(race.date).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" })} ·{" "}
        {race.season.year} season · Field size {race.fieldSize}
      </p>

      {canEnterResults && (
        <Card title="Commissioner tools">
          <p>
            <Link href={`/races/${raceId}/tiers`}>Assign weekly tiers</Link> ·{" "}
            <Link href={`/races/${raceId}/qualifying`}>Enter qualifying results</Link> ·{" "}
            <Link href={`/races/${raceId}/results`}>
              {race.results.length > 0 ? "Edit results" : "Enter results"}
            </Link>
          </p>
          <SyncFromNascarButton raceId={raceId} lastSyncedAt={race.lastSyncedAt?.toISOString() ?? null} />
        </Card>
      )}

      <Card title="Results">
        {race.results.length === 0 ? (
          <p>Results haven&apos;t been entered for this race yet.</p>
        ) : (
          <table>
            <caption>Only drivers picked in at least one league — not the full field.</caption>
            <thead>
              <tr>
                <th>Finish</th>
                <th>Driver</th>
              </tr>
            </thead>
            <tbody>
              {race.results.map((r) => (
                <tr key={r.id}>
                  <td>{r.finishingPosition}</td>
                  <td>{r.driver.name}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </main>
  );
}
