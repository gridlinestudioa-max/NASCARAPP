import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import Card from "@/components/ui/Card";
import Breadcrumb from "@/components/ui/Breadcrumb";
import FactsGrid from "@/components/ui/FactsGrid";
import RaceResultsTabs, { type ResultRow } from "@/components/race/RaceResultsTabs";
import { normalizeTrackName } from "@/lib/nascarFeed";
import styles from "./page.module.css";

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
      stageResults: { include: { driver: true }, orderBy: [{ stageNumber: "asc" }, { position: "asc" }] },
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

  const displayName = race.venueName ?? race.trackName;
  const eventName = race.venueName ? race.trackName : null;

  const finalRows: ResultRow[] = race.results.map((r) => ({ pos: r.finishingPosition, driver: r.driver.name }));
  const stage1Rows: ResultRow[] = race.stageResults
    .filter((s) => s.stageNumber === 1)
    .map((s) => ({ pos: s.position, driver: s.driver.name }));
  const stage2Rows: ResultRow[] = race.stageResults
    .filter((s) => s.stageNumber === 2)
    .map((s) => ({ pos: s.position, driver: s.driver.name }));

  return (
    <main>
      <Breadcrumb items={[{ label: "Schedule", href: "/races" }, { label: displayName }]} />

      <div className={styles.eyebrow}>Week {race.week}</div>
      <h1>{displayName}</h1>
      {eventName && <p className={styles.eventName}>{eventName}</p>}

      <FactsGrid
        items={[
          {
            label: "Date",
            value: new Date(race.date).toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric", year: "numeric" }),
          },
          { label: "Time", value: new Date(race.date).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" }) },
          { label: "Field Size", value: race.fieldSize },
          { label: "Season", value: `${race.season.year}` },
          ...(past3Winners.length > 0
            ? [{ label: "Last Year's Winner", value: past3Winners[0].driverName, fullWidth: true }]
            : []),
        ]}
      />

      <Card title="Results">
        <RaceResultsTabs stage1={stage1Rows} stage2={stage2Rows} final={finalRows} />
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
