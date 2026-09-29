import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { isSiteAdmin } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import Card from "@/components/ui/Card";
import Breadcrumb from "@/components/ui/Breadcrumb";
import DeleteUserForm from "./DeleteUserForm";
import styles from "./page.module.css";

export const dynamic = "force-dynamic";

export default async function AdminUsersPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  if (!isSiteAdmin(session.user.email)) redirect("/admin");

  const users = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { memberships: true, picks: true } } },
  });

  const ownedLeagues = await prisma.league.findMany({ select: { ownerId: true, name: true } });
  const ownedLeaguesByUserId = new Map<string, string[]>();
  for (const league of ownedLeagues) {
    const names = ownedLeaguesByUserId.get(league.ownerId) ?? [];
    names.push(league.name);
    ownedLeaguesByUserId.set(league.ownerId, names);
  }

  return (
    <main>
      <Breadcrumb items={[{ label: "Dashboards" }, { label: "Admin", href: "/admin" }, { label: "Users" }]} />
      <h1>Users</h1>
      <p>
        Delete a user to permanently remove their account and everything tied to it — league memberships, picks, and
        scores. This can&apos;t be undone. A user who still owns a league has to be reassigned or have that league
        deleted first (see <em>Leagues</em>).
      </p>

      <Card title={`All users (${users.length})`}>
        {users.length === 0 ? (
          <p className={styles.empty}>No users exist.</p>
        ) : (
          <ul className={styles.userList}>
            {users.map((user) => {
              const identifier = user.name?.trim() || user.email;
              const owned = ownedLeaguesByUserId.get(user.id) ?? [];
              return (
                <li key={user.id} className={styles.user}>
                  <div className={styles.userInfo}>
                    <p className={styles.userName}>{identifier}</p>
                    <p className={styles.userMeta}>
                      {user.email} · {user._count.memberships} membership{user._count.memberships === 1 ? "" : "s"} ·{" "}
                      {user._count.picks} pick{user._count.picks === 1 ? "" : "s"} · joined{" "}
                      {user.createdAt.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
                      {owned.length > 0 && <> · owns {owned.join(", ")}</>}
                    </p>
                  </div>
                  <DeleteUserForm userId={user.id} identifier={identifier} />
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </main>
  );
}
