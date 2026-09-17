import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

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
      <p>
        <Link href="/my-leagues">&larr; My Leagues</Link>
      </p>
      <h1>Schedule</h1>
      {season && <p>{season.year} season</p>}

      {races.length === 0 ? (
        <p>No schedule has been set up yet.</p>
      ) : (
        <ul>
          {races.map((r) => (
            <li key={r.id}>
              <Link href={`/races/${r.id}`}>
                Week {r.week} — {r.trackName}
              </Link>{" "}
              — {new Date(r.date).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
              {r.status === "COMPLETE" && " (final)"}
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
