import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import Card from "@/components/ui/Card";
import { normalizeTrackName } from "@/lib/nascarFeed";

export const dynamic = "force-dynamic";

type PastWinner = { year: number; driverName: string };

export default async function RacePage(props: PageProps<"/races/[raceId]">) {
  const { raceId } = await props.params;

  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const race = await prisma.race.findUnique({
    where: { id: raceId },
    include: {
      season: true,
      results: { include: { driver: true }, orderBy: { finishingPosition: "asc" } },
      stageResults: { where: { position: 1 }, include: { driver: true }, orderBy: { stageNumber: "asc" } },
    },
  });
  if (!race) {
    notFound();
  }

  // Past winners of this same race (not just the venue — see
  // normalizeTrackName's own reasoning for why race identity is name-based:
  // a track that hosts two differently-named races a year, like
  // Martinsville, shouldn't have them conflated), pulled from both our own
  // synced history and the imported pre-app archive.
  const normalizedTrack = normalizeTrackName(race.trackName);
  const [liveWinners, archivedWinners] = await Promise.all([
    prisma.raceResult.findMany({
      where: { finishingPosition: 1, raceId: { not: race.id } },
      include: { driver: true, race: { select: { trackName: true, season: { select: { year: true } } } } },
    }),
    prisma.historicalRaceResult.findMany({ where: { finishingPosition: 1 }, include: { driver: true } }),
  ]);
  const pastWinners: PastWinner[] = [];
  for (const w of liveWinners) {
    if (normalizeTrackName(w.race.trackName) !== normalizedTrack) continue;
    pastWinners.push({ year: w.race.season.year, driverName: w.driver.name });
  }
  for (const w of archivedWinners) {
    if (normalizeTrackName(w.trackName) !== normalizedTrack) continue;
    pastWinners.push({ year: w.year, driverName: w.driver.name });
  }
  pastWinners.sort((a, b) => b.year - a.year);
  const past3Winners = pastWinners.slice(0, 3);

  return (
    <main>
      <p>
        <Link href="/races">&larr; Schedule</Link>
      </p>
      <h1>
        Week {race.week} — {race.trackName}
      </h1>
      <p>
        {race.venueName && <>{race.venueName} · </>}
        {new Date(race.date).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" })} ·{" "}
        {race.season.year} season · Field size {race.fieldSize}
      </p>

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

      <Card title="Stage winners">
        {race.stageResults.length === 0 ? (
          <p>No stage results yet.</p>
        ) : (
          <ul className="rowList">
            {race.stageResults.map((s) => (
              <li key={s.id}>
                <span>Stage {s.stageNumber}</span>
                <span>{s.driver.name}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card title="Past winners">
        {past3Winners.length === 0 ? (
          <p>No past results for this race in our data yet.</p>
        ) : (
          <ul className="rowList">
            {past3Winners.map((w) => (
              <li key={w.year}>
                <span>{w.year}</span>
                <span>{w.driverName}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </main>
  );
}
