import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function MyLeaguesPage() {
  const session = await auth();
  // Also guards against a stale session predating a session-shape change
  // (e.g. before user.id was added to the token) — without this, a
  // missing id would silently drop the where-filter below instead of
  // matching nothing.
  if (!session?.user?.id) {
    redirect("/login");
  }

  const memberships = await prisma.leagueMembership.findMany({
    where: { userId: session.user.id },
    include: { league: true },
    orderBy: { league: { name: "asc" } },
  });

  return (
    <main>
      <h1>My Leagues</h1>
      {memberships.length === 0 ? (
        <p>You&apos;re not in any leagues yet.</p>
      ) : (
        <ul>
          {memberships.map((m) => (
            <li key={m.id}>
              <Link href={`/leagues/${m.league.id}`}>{m.league.name}</Link>
              {m.role === "OWNER" && " (owner)"}
            </li>
          ))}
        </ul>
      )}
      <p>
        <Link href="/leagues/new">Create a league</Link> or{" "}
        <Link href="/leagues/join">join one with an invite code</Link>.
      </p>
    </main>
  );
}
