import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function MyLeaguesPage() {
  const session = await auth();
  if (!session?.user) {
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
    </main>
  );
}
