import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import LeagueRulesForm from "./LeagueRulesForm";

export const dynamic = "force-dynamic";

export default async function NewLeaguePage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const racesWithResults = await prisma.race.findMany({
    where: { results: { some: {} } },
    orderBy: { week: "asc" },
  });
  const completedRaces = racesWithResults.map((r) => ({ id: r.id, label: `Week ${r.week} — ${r.trackName}` }));

  return (
    <main>
      <p>
        <Link href="/my-leagues">&larr; My Leagues</Link>
      </p>
      <h1>Create a league</h1>
      <p>You&apos;ll be the owner and can invite others once it&apos;s created.</p>
      <LeagueRulesForm completedRaces={completedRaces} />
    </main>
  );
}
