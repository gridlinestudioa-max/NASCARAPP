import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import Card from "@/components/ui/Card";
import EntryListForm from "./EntryListForm";

export const dynamic = "force-dynamic";

export default async function EnterEntryListPage(props: PageProps<"/admin/races/[raceId]/entries">) {
  const { raceId } = await props.params;

  const race = await prisma.race.findUnique({ where: { id: raceId } });
  if (!race) {
    notFound();
  }

  const existingEntries = await prisma.raceEntry.findMany({
    where: { raceId },
    include: { driver: true },
    orderBy: { carNumber: "asc" },
  });

  const existingText = existingEntries
    .map((e) => (e.carNumber != null ? `${e.carNumber} - ${e.driver.name}` : e.driver.name))
    .join("\n");

  return (
    <main>
      <p>
        <Link href={`/admin/races/${raceId}`}>&larr; Week {race.week}</Link>
      </p>
      <h1>
        Entry list — Week {race.week}, {race.trackName}
      </h1>
      <Card>
        <p>
          Paste this week&apos;s field, one driver per line. Car numbers are optional — with or without them both
          work:
        </p>
        <pre>{"5 - Kyle Larson\n24 - William Byron\nDenny Hamlin"}</pre>
        <p>Saving replaces the entire list below with whatever you submit — so paste the full field each time.</p>
        <EntryListForm raceId={raceId} initialText={existingText} />
      </Card>
    </main>
  );
}
