import { prisma } from "@/lib/prisma";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import {
  parseTieredDraftRuleSetConfig,
  TIERED_LINEUP_SLOTS,
  lineupLockPhase,
  entryListUnlockAt,
  type DriverTier,
} from "@/lib/tieredDraft";
import { computeRecentFormAvgFinish } from "@/lib/tierRanking";
import { nextEntryListWindowAt } from "@/lib/nascarSyncSchedule";
import TieredLineupForm from "@/app/leagues/[leagueId]/races/[raceId]/TieredLineupForm";
import lineupFormStyles from "@/app/leagues/[leagueId]/races/[raceId]/TieredLineupForm.module.css";

const TIER_SLOT_CLASS: Record<DriverTier, string> = {
  A: lineupFormStyles.slotA,
  B: lineupFormStyles.slotB,
  C: lineupFormStyles.slotC,
};

// The tiered-draft lineup-setting experience for one race — shared by the
// standalone /leagues/[leagueId]/races/[raceId] page (any week) and the
// league hub's default "Pick" tab (always the next open race).
export default async function TieredLineupPickPanel({
  leagueId,
  raceId,
  userId,
  race,
  leagueSeason,
}: {
  leagueId: string;
  raceId: string;
  userId: string;
  race: {
    week: number;
    trackName: string;
    venueName: string | null;
    date: Date;
    qualifyingAt: Date | null;
    seasonId: string;
    status: string;
  };
  leagueSeason: { ruleSet: { config: unknown }; league: { name: string } };
}) {
  const config = parseTieredDraftRuleSetConfig(leagueSeason.ruleSet.config);
  const phase = lineupLockPhase(race, currentTimestamp());
  // A race can be scored before its natural lock time passes (results
  // entered early, or a race rescheduled after the fact) — show the
  // scored view whenever that's happened, not just once the clock says so.
  const hasResults = race.status === "COMPLETE";

  const tierAssignments = await prisma.driverTierAssignment.findMany({ where: { raceId }, include: { driver: true } });

  if (phase === "locked" || hasResults) {
    const picks = await prisma.pick.findMany({
      where: { leagueId, raceId },
      include: { user: true, driver: true, score: true },
    });
    const members = await prisma.leagueMembership.findMany({ where: { leagueId }, include: { user: true } });
    const totalByUserId = new Map<string, number>();
    for (const p of picks) {
      totalByUserId.set(p.userId, (totalByUserId.get(p.userId) ?? 0) + (p.score?.total ?? 0));
    }
    const myPicks = picks.filter((p) => p.userId === userId).sort((a, b) => a.pickNumber - b.pickNumber);
    const slotByPickNumber = new Map(TIERED_LINEUP_SLOTS.map((s) => [s.pickNumber, s]));

    return (
      <>
        <p>{phase === "locked" ? "Lineups are locked for this race." : "Results are in for this race."}</p>

        <Card title="Your lineup">
          {myPicks.length === 0 ? (
            <p>You didn&apos;t have a lineup set for this race.</p>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Slot</th>
                  <th>Driver</th>
                  <th>Qualified</th>
                  <th>Qual. pts</th>
                  <th>Finish</th>
                  <th>Finish pts</th>
                  <th>Total</th>
                </tr>
              </thead>
              <tbody>
                {myPicks.map((p) => {
                  const slot = slotByPickNumber.get(p.pickNumber);
                  return (
                    <tr key={p.id}>
                      <td>
                        {slot ? `Tier ${slot.tier} ${slot.role === "STARTER" ? "starter" : "bench"}` : p.pickNumber}
                      </td>
                      <td>{p.driver.name}</td>
                      <td>{p.score?.qualifyingPosition ?? "—"}</td>
                      <td>{p.score?.qualifyingBonus ?? "—"}</td>
                      <td>{p.score?.finishPosition ?? "—"}</td>
                      <td>{p.score?.baseScore ?? "—"}</td>
                      <td>{p.score?.total ?? "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </Card>

        <Card title="Team totals this week">
          <ul className="rowList">
            {members
              .map((m) => ({ name: m.user.name ?? m.user.email, total: totalByUserId.get(m.userId) ?? 0 }))
              .sort((a, b) => b.total - a.total)
              .map((m) => (
                <li key={m.name}>
                  {m.name}
                  <strong>{m.total}</strong>
                </li>
              ))}
          </ul>
        </Card>
      </>
    );
  }

  const notYetOpen = phase === "notYetOpen" || tierAssignments.length === 0;

  if (notYetOpen) {
    // Tiers already assigned but the Tuesday floor hasn't passed yet (e.g.
    // an admin set them early by hand) — the exact Tuesday is known. If
    // tiers aren't assigned yet even though Tuesday has passed, fall back
    // to explaining when the next sync window is, since that's the real
    // blocker at that point.
    const now = new Date();
    const nextWindowAt = phase === "notYetOpen" ? entryListUnlockAt(race) : nextEntryListWindowAt(now);
    // We're already inside today's entry-list window (noon-midnight
    // Tuesday/Friday) and just waiting on the next sync tick to actually
    // pull it — a clock time here would print "now", which reads oddly.
    const waitingOnSyncToday = phase !== "notYetOpen" && nextWindowAt.getTime() <= now.getTime();
    const unlockLabel = waitingOnSyncToday
      ? "later today, once this week's entry list syncs"
      : nextWindowAt.toLocaleString(undefined, {
          weekday: "long",
          hour: "numeric",
          minute: "2-digit",
        });
    const starterSlots = TIERED_LINEUP_SLOTS.filter((s) => s.role === "STARTER");
    const benchSlots = TIERED_LINEUP_SLOTS.filter((s) => s.role === "BENCH");
    const renderLockedSlot = (tier: DriverTier) => (
      <div className={`${lineupFormStyles.slot} ${TIER_SLOT_CLASS[tier]} ${lineupFormStyles.slotLocked}`}>
        <span className={lineupFormStyles.tierTag}>Tier {tier}</span>
        <span className={lineupFormStyles.placeholder}>Locked</span>
        <span className={lineupFormStyles.tapHint}>Unlocks {unlockLabel}</span>
      </div>
    );

    return (
      <Card title="Your lineup">
        <p>
          <em>Lineups unlock {unlockLabel}.</em>
        </p>
        <span className={lineupFormStyles.roleLabel}>Starters</span>
        <div className={lineupFormStyles.slotRow}>
          {starterSlots.map((s) => (
            <div key={s.pickNumber}>{renderLockedSlot(s.tier)}</div>
          ))}
        </div>
        <div className={lineupFormStyles.roleGroup}>
          <span className={lineupFormStyles.roleLabel}>Bench</span>
          <div className={lineupFormStyles.slotRow}>
            {benchSlots.map((s) => (
              <div key={s.pickNumber}>{renderLockedSlot(s.tier)}</div>
            ))}
          </div>
        </div>
      </Card>
    );
  }

  const driverNamesByTier: Record<DriverTier, { id: string; name: string }[]> = { A: [], B: [], C: [] };
  for (const a of tierAssignments) {
    driverNamesByTier[a.tier].push({ id: a.driverId, name: a.driver.name });
  }
  for (const tier of ["A", "B", "C"] as const) {
    driverNamesByTier[tier].sort((a, b) => a.name.localeCompare(b.name));
  }

  const [myPicks, seasonRaces, members, avgFinishByDriverId] = await Promise.all([
    prisma.pick.findMany({ where: { leagueId, userId, raceId } }),
    prisma.race.findMany({ where: { seasonId: race.seasonId, id: { not: raceId } }, select: { id: true } }),
    prisma.leagueMembership.findMany({ where: { leagueId }, include: { user: true } }),
    computeRecentFormAvgFinish(tierAssignments.map((a) => a.driverId), race.seasonId, race.week),
  ]);

  const starterSlotNumbers = TIERED_LINEUP_SLOTS.filter((s) => s.role === "STARTER").map((s) => s.pickNumber);
  const priorStarterPicks = await prisma.pick.findMany({
    where: { leagueId, userId, raceId: { in: seasonRaces.map((r) => r.id) }, pickNumber: { in: starterSlotNumbers } },
  });
  const startsUsedByDriverId = new Map<string, number>();
  for (const p of priorStarterPicks) {
    startsUsedByDriverId.set(p.driverId, (startsUsedByDriverId.get(p.driverId) ?? 0) + 1);
  }
  const driversByTier: Record<DriverTier, { id: string; name: string; startsUsed: number; avgFinish: number | null }[]> = {
    A: driverNamesByTier.A.map((d) => ({ ...d, startsUsed: startsUsedByDriverId.get(d.id) ?? 0, avgFinish: avgFinishByDriverId.get(d.id) ?? null })),
    B: driverNamesByTier.B.map((d) => ({ ...d, startsUsed: startsUsedByDriverId.get(d.id) ?? 0, avgFinish: avgFinishByDriverId.get(d.id) ?? null })),
    C: driverNamesByTier.C.map((d) => ({ ...d, startsUsed: startsUsedByDriverId.get(d.id) ?? 0, avgFinish: avgFinishByDriverId.get(d.id) ?? null })),
  };

  let currentDriverIdByPickNumber: (string | null)[] = Array.from(
    { length: 8 },
    (_, i) => myPicks.find((p) => p.pickNumber === i + 1)?.driverId ?? null,
  );
  let usingCarriedOverPreview = false;

  if (myPicks.length === 0) {
    const priorPicksAll = await prisma.pick.findMany({
      where: { leagueId, userId, race: { seasonId: race.seasonId, week: { lt: race.week } } },
      include: { race: true },
      orderBy: { race: { week: "desc" } },
    });
    const mostRecentWeek = priorPicksAll[0]?.race.week;
    if (mostRecentWeek != null) {
      const priorPicks = priorPicksAll.filter((p) => p.race.week === mostRecentWeek);
      const tierByDriverId = new Map(tierAssignments.map((a) => [a.driverId, a.tier]));
      const preview = Array.from({ length: 8 }, (_, i) => {
        const pickNumber = i + 1;
        const slot = TIERED_LINEUP_SLOTS.find((s) => s.pickNumber === pickNumber)!;
        const prior = priorPicks.find((p) => p.pickNumber === pickNumber);
        if (prior && tierByDriverId.get(prior.driverId) === slot.tier) return prior.driverId;
        return null;
      });
      if (preview.some((d) => d != null)) {
        currentDriverIdByPickNumber = preview;
        usingCarriedOverPreview = true;
      }
    }
  }

  const lineupSetUserIds = new Set(
    (await prisma.pick.findMany({ where: { leagueId, raceId }, select: { userId: true } })).map((p) => p.userId),
  );

  return (
    <>
      <Card title="Your lineup">
        <TieredLineupForm
          leagueId={leagueId}
          raceId={raceId}
          lockPhase={phase}
          maxStartsPerDriverPerSeason={config.maxStartsPerDriverPerSeason}
          driversByTier={driversByTier}
          currentDriverIdByPickNumber={currentDriverIdByPickNumber}
          usingCarriedOverPreview={usingCarriedOverPreview}
        />
      </Card>

      <Card title="Roster Status">
        <ul className="rowList">
          {members.map((m) => (
            <li key={m.userId}>
              {m.user.name ?? m.user.email}
              <Badge tone={lineupSetUserIds.has(m.userId) ? "accent" : "neutral"}>
                {lineupSetUserIds.has(m.userId) ? "Set" : "Not yet"}
              </Badge>
            </li>
          ))}
        </ul>
      </Card>
    </>
  );
}

function currentTimestamp(): number {
  return Date.now();
}
