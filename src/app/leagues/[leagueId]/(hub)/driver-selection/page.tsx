import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import { parseRuleSetConfig } from "@/lib/scoring";
import { parseTieredDraftRuleSetConfig, TIERED_LINEUP_SLOTS } from "@/lib/tieredDraft";
import { getLeagueHubData } from "../leagueData";

export const dynamic = "force-dynamic";

export default async function DriverSelectionPage(props: { params: Promise<{ leagueId: string }> }) {
  const { leagueId } = await props.params;

  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const data = await getLeagueHubData(leagueId, session.user.id);
  if (!data) {
    notFound();
  }

  const { league, leagueSeason, picks } = data;
  const userId = session.user.id;
  const myPicks = picks.filter((p) => p.userId === userId);

  if (league.type === "TIERED_DRAFT") {
    const config = leagueSeason ? parseTieredDraftRuleSetConfig(leagueSeason.ruleSet.config) : null;
    const starterSlotNumbers = new Set(
      TIERED_LINEUP_SLOTS.filter((s) => s.role === "STARTER").map((s) => s.pickNumber),
    );
    const startsByDriver = new Map<string, number>();
    for (const p of myPicks) {
      if (!starterSlotNumbers.has(p.pickNumber)) continue;
      startsByDriver.set(p.driver.name, (startsByDriver.get(p.driver.name) ?? 0) + 1);
    }
    const rows = [...startsByDriver.entries()].sort((a, b) => b[1] - a[1]);
    const max = config?.maxStartsPerDriverPerSeason ?? null;

    return (
      <Card title="Driver Selection">
        <p>
          Starts used per driver this season{max != null ? ` — limit ${max} start(s) each` : ""}. Benching a
          driver doesn&apos;t count against this cap, only starting them does.
        </p>
        {rows.length === 0 ? (
          <p>No starts recorded yet.</p>
        ) : (
          <ul className="rowList">
            {rows.map(([name, count]) => (
              <li key={name}>
                {name}
                <Badge tone={max != null && count >= max ? "warning" : "neutral"}>
                  {count}
                  {max != null ? ` of ${max}` : ""}
                  {max != null && count >= max ? " — limit reached" : ""}
                </Badge>
              </li>
            ))}
          </ul>
        )}
      </Card>
    );
  }

  const config = leagueSeason ? parseRuleSetConfig(leagueSeason.ruleSet.config) : null;
  const max = config?.maxPicksPerDriverPerSeason ?? null;
  const countByDriver = new Map<string, number>();
  for (const p of myPicks) {
    countByDriver.set(p.driver.name, (countByDriver.get(p.driver.name) ?? 0) + 1);
  }
  const rows = [...countByDriver.entries()].sort((a, b) => b[1] - a[1]);

  return (
    <Card title="Driver Selection">
      <p>
        {max == null
          ? "Unlimited repeat picks — no per-driver cap this season."
          : `Each driver can be picked up to ${max} time(s) this season.`}
      </p>
      {rows.length === 0 ? (
        <p>You haven&apos;t made a pick yet this season.</p>
      ) : (
        <ul className="rowList">
          {rows.map(([name, count]) => (
            <li key={name}>
              {name}
              <Badge tone={max != null && count >= max ? "warning" : "neutral"}>
                {count}
                {max != null ? ` of ${max}` : ""}
                {max != null && count >= max ? " — limit reached" : ""}
              </Badge>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
