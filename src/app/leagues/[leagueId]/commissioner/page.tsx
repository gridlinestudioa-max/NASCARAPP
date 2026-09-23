import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { parseRuleSetConfig } from "@/lib/scoring";
import { parseTieredDraftRuleSetConfig } from "@/lib/tieredDraft";
import { sanitizePickOrder, type PickOrderMode } from "@/lib/pickOrder";
import LeagueRulesForm from "@/components/LeagueRulesForm";
import Card from "@/components/ui/Card";
import Breadcrumb from "@/components/ui/Breadcrumb";
import { displayRaceName } from "@/lib/raceName";
import { getLeagueHubData } from "../(hub)/leagueData";
import TransferCommissionerForm from "./TransferCommissionerForm";
import PickOrderForm from "./PickOrderForm";
import LeagueIconForm from "./LeagueIconForm";

export const dynamic = "force-dynamic";

// Deliberately outside the (hub) route group — this page is a focused
// tool, not another view of the league, so it skips the hub layout's
// hero/up-next/tabs chrome entirely and gets just a back link back to it.
// Gated the same way the old standalone /settings page was: redirect a
// non-owner straight back to standings rather than exposing a "you're not
// allowed" page.
export default async function CommissionerPage(props: { params: Promise<{ leagueId: string }> }) {
  const { leagueId } = await props.params;

  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const data = await getLeagueHubData(leagueId, session.user.id);
  if (!data) {
    notFound();
  }
  const { league, membership, leagueSeason, members } = data;
  if (membership.role !== "OWNER") {
    redirect(`/leagues/${leagueId}`);
  }

  const racesWithResults = await prisma.race.findMany({ where: { results: { some: {} } }, orderBy: { week: "asc" } });
  const completedRaces = racesWithResults.map((r) => ({ id: r.id, label: `Week ${r.week} — ${displayRaceName(r.trackName)}` }));

  const pickemConfig = league.type === "PICKEM" && leagueSeason ? parseRuleSetConfig(leagueSeason.ruleSet.config) : undefined;
  const tieredConfig =
    league.type === "TIERED_DRAFT" && leagueSeason ? parseTieredDraftRuleSetConfig(leagueSeason.ruleSet.config) : undefined;

  return (
    <main>
      <Breadcrumb
        items={[
          { label: "Home", href: "/" },
          { label: league.name, href: `/leagues/${leagueId}` },
          { label: "Commissioner Tools" },
        ]}
      />

      <h1>Commissioner tools</h1>

      <p>
        Invite code: <code>{league.inviteCode}</code> — share it so others can join this league.
      </p>

      <Card title="League Icon">
        <LeagueIconForm leagueId={leagueId} leagueName={league.name} iconUrl={league.iconUrl} />
      </Card>

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
