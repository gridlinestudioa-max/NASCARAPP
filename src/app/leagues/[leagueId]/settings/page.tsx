import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { parseRuleSetConfig } from "@/lib/scoring";
import { parseTieredDraftRuleSetConfig } from "@/lib/tieredDraft";
import { sanitizePickOrder, type PickOrderMode } from "@/lib/pickOrder";
import LeagueRulesForm from "@/components/LeagueRulesForm";
import Card from "@/components/ui/Card";
import TransferCommissionerForm from "./TransferCommissionerForm";
import PickOrderForm from "./PickOrderForm";

export const dynamic = "force-dynamic";

export default async function LeagueSettingsPage(props: PageProps<"/leagues/[leagueId]/settings">) {
  const { leagueId } = await props.params;

  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const membership = await prisma.leagueMembership.findUnique({
    where: { leagueId_userId: { leagueId, userId: session.user.id } },
  });
  if (!membership) {
    notFound();
  }
  if (membership.role !== "OWNER") {
    redirect(`/leagues/${leagueId}`);
  }

  const league = await prisma.league.findUnique({ where: { id: leagueId } });
  if (!league) {
    notFound();
  }

  const [leagueSeason, members, racesWithResults] = await Promise.all([
    prisma.leagueSeason.findFirst({
      where: { leagueId },
      include: { ruleSet: true, season: true },
      orderBy: { season: { year: "desc" } },
    }),
    prisma.leagueMembership.findMany({ where: { leagueId }, include: { user: true }, orderBy: { createdAt: "asc" } }),
    prisma.race.findMany({ where: { results: { some: {} } }, orderBy: { week: "asc" } }),
  ]);
  const completedRaces = racesWithResults.map((r) => ({ id: r.id, label: `Week ${r.week} — ${r.trackName}` }));

  const pickemConfig = league.type === "PICKEM" && leagueSeason ? parseRuleSetConfig(leagueSeason.ruleSet.config) : undefined;
  const tieredConfig =
    league.type === "TIERED_DRAFT" && leagueSeason ? parseTieredDraftRuleSetConfig(leagueSeason.ruleSet.config) : undefined;

  return (
    <main>
      <p>
        <Link href={`/leagues/${leagueId}`}>&larr; {league.name}</Link>
      </p>
      <h1>League settings — {league.name}</h1>

      <Card title="Commissioner">
        <TransferCommissionerForm
          leagueId={leagueId}
          members={members.map((m) => ({
            userId: m.userId,
            name: m.user.name ?? m.user.email,
            isCurrentOwner: m.userId === league.ownerId,
          }))}
        />
      </Card>

      {league.type === "PICKEM" && (() => {
        const nameByUserId = new Map(members.map((m) => [m.userId, m.user.name ?? m.user.email]));
        const order = sanitizePickOrder(league.pickOrder, members.map((m) => m.userId));
        return (
          <Card title="Pick order">
            <PickOrderForm
              leagueId={leagueId}
              mode={league.pickOrderMode as PickOrderMode}
              members={order.map((userId) => ({ userId, name: nameByUserId.get(userId) ?? "—" }))}
            />
          </Card>
        );
      })()}

      <h2>Rules</h2>
      {leagueSeason ? (
        <LeagueRulesForm
          completedRaces={completedRaces}
          editingLeague={{ id: league.id, type: league.type, pickemConfig, tieredConfig }}
        />
      ) : (
        <Card>
          <p>This league isn&apos;t part of a season yet, so there are no rules to edit.</p>
        </Card>
      )}
    </main>
  );
}
