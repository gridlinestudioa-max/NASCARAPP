import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import Card from "@/components/ui/Card";
import Breadcrumb from "@/components/ui/Breadcrumb";
import { displayRaceName } from "@/lib/raceName";
import ScheduleEditForm from "./ScheduleEditForm";

export const dynamic = "force-dynamic";

export default async function AdminRacePage(props: PageProps<"/admin/races/[raceId]">) {
  const { raceId } = await props.params;

  const race = await prisma.race.findUnique({
    where: { id: raceId },
    include: { season: true, results: { include: { driver: true }, orderBy: { finishingPosition: "asc" } } },
  });
  if (!race) {
    notFound();
  }

  return (
    <main>
      <Breadcrumb items={[{ label: "Admin", href: "/admin" }, { label: displayRaceName(race.trackName) }]} />
      <h1>
        Week {race.week} — {displayRaceName(race.trackName)}
      </h1>
      <p>
        {race.season.year} season · Field size {race.fieldSize} · {race.status}
        {race.lastSyncedAt &&
          ` · last synced ${race.lastSyncedAt.toLocaleString(undefined, { dateStyle: "short", timeStyle: "short" })}`}
      </p>

      <Card title="Schedule">
        <ScheduleEditForm raceId={raceId} trackName={race.trackName} date={race.date.toISOString().slice(0, 10)} />
      </Card>

      <Card title="Race data">
        <p>
          <Link href={`/admin/races/${raceId}/entries`}>Enter entry list</Link> ·{" "}
          <Link href={`/admin/races/${raceId}/tiers`}>Assign weekly tiers</Link> ·{" "}
          <Link href={`/admin/races/${raceId}/qualifying`}>Enter qualifying results</Link> ·{" "}
          <Link href={`/admin/races/${raceId}/results`}>
            {race.results.length > 0 ? "Edit results" : "Enter results"}
          </Link>
        </p>
      </Card>

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
