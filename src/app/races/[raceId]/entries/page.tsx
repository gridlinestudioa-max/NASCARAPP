import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ownsALeagueInSeason } from "@/lib/authz";
import Card from "@/components/ui/Card";
import EntryListForm from "./EntryListForm";

export const dynamic = "force-dynamic";

export default async function EnterEntryListPage(props: PageProps<"/races/[raceId]/entries">) {
  const { raceId } = await props.params;

  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const race = await prisma.race.findUnique({ where: { id: raceId } });
  if (!race) {
    notFound();
  }

  const authorized = await ownsALeagueInSeason(session.user.id, race.seasonId);
  if (!authorized) {
    redirect(`/races/${raceId}`);
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
        <Link href={`/races/${raceId}`}>&larr; Week {race.week}</Link>
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
