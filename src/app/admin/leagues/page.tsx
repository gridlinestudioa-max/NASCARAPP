import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { isSiteAdmin } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import Card from "@/components/ui/Card";
import Breadcrumb from "@/components/ui/Breadcrumb";
import ConfirmDeleteForm from "@/components/admin/ConfirmDeleteForm";
import { deleteLeagueAction } from "./actions";
import styles from "../adminList.module.css";

export const dynamic = "force-dynamic";

export default async function AdminLeaguesPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  if (!isSiteAdmin(session.user.email)) redirect("/admin");

  const leagues = await prisma.league.findMany({
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { memberships: true, picks: true } } },
  });

  const ownerIds = [...new Set(leagues.map((l) => l.ownerId))];
  const owners = ownerIds.length
    ? await prisma.user.findMany({ where: { id: { in: ownerIds } }, select: { id: true, name: true, email: true } })
    : [];
  const ownerById = new Map(owners.map((o) => [o.id, o]));

  return (
    <main>
      <Breadcrumb items={[{ label: "Dashboards" }, { label: "Admin", href: "/admin" }, { label: "Leagues" }]} />
      <h1>Leagues</h1>
      <p>
        Delete a league to permanently remove it and everything in it — memberships, rule sets, and every pick/score
        its members have. This can&apos;t be undone. Use it to clear out test leagues; it has no effect on the
        shared schedule, driver roster, or any other league.
      </p>

      <Card title={`All leagues (${leagues.length})`}>
        {leagues.length === 0 ? (
          <p className={styles.empty}>No leagues exist.</p>
        ) : (
          <ul className={styles.list}>
            {leagues.map((league) => {
              const owner = ownerById.get(league.ownerId);
              return (
                <li key={league.id} className={styles.row}>
                  <div className={styles.rowInfo}>
                    <p className={styles.rowName}>{league.name}</p>
                    <p className={styles.rowMeta}>
                      {league.type === "PICKEM" ? "Pick'em" : "Tiered Lineup"} · {league._count.memberships} member
                      {league._count.memberships === 1 ? "" : "s"} · {league._count.picks} pick
                      {league._count.picks === 1 ? "" : "s"} · owned by {owner?.name ?? owner?.email ?? "unknown"} ·
                      created {league.createdAt.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
                    </p>
                  </div>
                  <ConfirmDeleteForm
                    id={league.id}
                    name={league.name}
                    action={deleteLeagueAction}
                    confirmMessage={`Permanently delete "${league.name}"? Every membership, rule set, pick, and score in it is gone for good.`}
                  />
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </main>
  );
}
