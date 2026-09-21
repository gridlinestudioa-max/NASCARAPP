import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import { parseRuleSetConfig, pickemLockAt } from "@/lib/scoring";
import {
  TIERED_LINEUP_SLOTS,
  lineupLockPhase,
  parseTieredDraftRuleSetConfig,
  type DriverTier,
} from "@/lib/tieredDraft";
import {
  PICK_ORDER_MODE_INFO,
  computePickOrderSeats,
  computeWeekPickOrder,
  sanitizePickOrder,
  type PickOrderMode,
} from "@/lib/pickOrder";
import { computeRecentFormAvgFinish } from "@/lib/tierRanking";
import { nextEntryListWindowAt } from "@/lib/nascarSyncSchedule";
import PickForm from "./PickForm";
import TieredLineupForm from "./TieredLineupForm";
import lineupFormStyles from "./TieredLineupForm.module.css";
import LiveRefresh from "@/components/league/LiveRefresh";

const TIER_SLOT_CLASS: Record<DriverTier, string> = {
  A: lineupFormStyles.slotA,
  B: lineupFormStyles.slotB,
  C: lineupFormStyles.slotC,
};

export const dynamic = "force-dynamic";

export default async function RaceDetailPage(
  props: PageProps<"/leagues/[leagueId]/races/[raceId]">,
) {
  const { leagueId, raceId } = await props.params;

  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }
  const userId = session.user.id;

  const membership = await prisma.leagueMembership.findUnique({
    where: { leagueId_userId: { leagueId, userId } },
  });
  if (!membership) {
    notFound();
  }

  const race = await prisma.race.findUnique({ where: { id: raceId } });
  if (!race) {
    notFound();
  }
  // Scope to this league: a race id that's real but belongs to a season
  // this league doesn't take part in shouldn't be reachable through this URL.
  const leagueSeason = await prisma.leagueSeason.findUnique({
    where: { leagueId_seasonId: { leagueId, seasonId: race.seasonId } },
    include: { ruleSet: true, league: true },
  });
  if (!leagueSeason) {
    notFound();
  }

  if (leagueSeason.league.type === "TIERED_DRAFT") {
    return renderTieredLineup({ leagueId, raceId, userId, race, leagueSeason });
  }
  return renderPickem({ leagueId, raceId, userId, race, leagueSeason });
}

async function renderPickem({
  leagueId,
  raceId,
  userId,
  race,
  leagueSeason,
}: {
  leagueId: string;
  raceId: string;
  userId: string;
  race: { week: number; trackName: string; date: Date; qualifyingAt: Date | null; fieldSize: number; seasonId: string };
  leagueSeason: {
    ruleSet: { config: unknown };
    league: { pickOrderMode: string; pickOrder: unknown };
  };
}) {
  const config = parseRuleSetConfig(leagueSeason.ruleSet.config);

  const picks = await prisma.pick.findMany({
    where: { leagueId, raceId },
    include: { user: true, driver: true, score: true },
    orderBy: [{ score: { total: "desc" } }, { pickNumber: "asc" }],
  });

  // Picks are open (and other players' driver choices stay hidden) until
  // either results come in or the race has already happened — whichever
  // comes first. Once locked, everyone's picks become visible.
  const hasResults = picks.some((p) => p.score);
  const now = Date.now();
  const isOpenForPicks = !hasResults && pickemLockAt(race, config.lockTiming).getTime() > now;

  if (isOpenForPicks) {
    const [members, entries, allActiveDrivers, joinOrderMemberships] = await Promise.all([
      prisma.leagueMembership.findMany({ where: { leagueId }, include: { user: true } }),
      prisma.raceEntry.findMany({ where: { raceId }, include: { driver: true }, orderBy: { driver: { name: "asc" } } }),
      prisma.driver.findMany({ where: { isActive: true }, orderBy: { name: "asc" } }),
      prisma.leagueMembership.findMany({ where: { leagueId }, orderBy: { createdAt: "asc" }, select: { userId: true } }),
    ]);
    // Once this week's entry list is known (from a NASCAR sync), scope
    // picks to who's actually racing instead of every driver ever seen.
    const allDrivers = entries.length > 0 ? entries.map((e) => e.driver) : allActiveDrivers;
    const myPicks = picks.filter((p) => p.userId === userId).sort((a, b) => a.pickNumber - b.pickNumber);
    const currentDriverIdBySlot = Array.from(
      { length: config.picksPerWeek },
      (_, i) => myPicks.find((p) => p.pickNumber === i + 1)?.driverId ?? null,
    );

    // Pick order: everyone takes a turn (their whole slate of picks at
    // once), and no two players in the league can hold the same driver in
    // the same week — see src/lib/pickOrder.ts.
    const pickOrderMode = leagueSeason.league.pickOrderMode as PickOrderMode;
    const baseOrder = sanitizePickOrder(leagueSeason.league.pickOrder, joinOrderMemberships.map((m) => m.userId));

    let pointsBeforeWeek: Map<string, number> | undefined;
    if (pickOrderMode === "STANDINGS_FIRST_TO_LAST" || pickOrderMode === "STANDINGS_LAST_TO_FIRST") {
      const priorPicks = await prisma.pick.findMany({
        where: { leagueId, race: { seasonId: race.seasonId, week: { lt: race.week } } },
        include: { score: true },
      });
      pointsBeforeWeek = new Map();
      for (const p of priorPicks) {
        pointsBeforeWeek.set(p.userId, (pointsBeforeWeek.get(p.userId) ?? 0) + (p.score?.total ?? 0));
      }
    }
    const weekOrder = computeWeekPickOrder(pickOrderMode, baseOrder, race.week, pointsBeforeWeek);
    const pickedUserIds = new Set(picks.map((p) => p.userId));
    const seats = computePickOrderSeats(weekOrder, pickedUserIds);
    const nameByUserId = new Map(members.map((m) => [m.userId, m.user.name ?? m.user.email]));

    const myTurn = seats.find((s) => s.userId === userId);
    const onTheClockSeat = seats.find((s) => s.status === "onTheClock");
    const canPick = myTurn?.status === "picked" || myTurn?.status === "onTheClock";
    // Drivers already claimed by someone else this week aren't offered —
    // whose pick is still visibly hidden until lock, just not the name.
    const takenByOthersIds = new Set(picks.filter((p) => p.userId !== userId).map((p) => p.driverId));
    const drivers = allDrivers.filter((d) => !takenByOthersIds.has(d.id));
    const takenDriverNames = allDrivers.filter((d) => takenByOthersIds.has(d.id)).map((d) => d.name);

    return (
      <main>
        <LiveRefresh />
        <p>
          <Link href={`/leagues/${leagueId}`}>&larr; Standings</Link>
        </p>
        <h1>
          Week {race.week} — {race.trackName}
        </h1>
        <p>
          {new Date(race.date).toLocaleDateString(undefined, {
            year: "numeric",
            month: "long",
            day: "numeric",
          })}
        </p>

        {canPick ? (
          <Card title={myPicks.length > 0 ? "Your pick" : "Make your pick"}>
            <PickForm
              leagueId={leagueId}
              raceId={raceId}
              drivers={drivers}
              picksPerWeek={config.picksPerWeek}
              currentDriverIdBySlot={currentDriverIdBySlot}
            />
          </Card>
        ) : (
          <Card title="Waiting for your turn">
            <p>
              {onTheClockSeat
                ? `${nameByUserId.get(onTheClockSeat.userId) ?? "Another player"} is on the clock. You're up at position ${myTurn?.position}.`
                : "Waiting for the pick order to open up."}
            </p>
          </Card>
        )}

        {takenDriverNames.length > 0 && (
          <Card title="Drivers taken this week">
            <ul className="rowList">
              {takenDriverNames.map((name) => (
                <li key={name}>{name}</li>
              ))}
            </ul>
          </Card>
        )}

        <Card title={`Pick order — ${PICK_ORDER_MODE_INFO[pickOrderMode].label}`}>
          <ul className="rowList">
            {seats.map((seat) => (
              <li key={seat.userId} style={seat.userId === userId ? { fontWeight: 700 } : undefined}>
                {seat.position}. {nameByUserId.get(seat.userId) ?? "—"}
                <Badge
                  tone={seat.status === "picked" ? "success" : seat.status === "onTheClock" ? "warning" : "neutral"}
                >
                  {seat.status === "picked" ? "Picked" : seat.status === "onTheClock" ? "On the clock" : "Waiting"}
                </Badge>
              </li>
            ))}
          </ul>
        </Card>
      </main>
    );
  }

  return (
    <main>
      <LiveRefresh />
      <p>
        <Link href={`/leagues/${leagueId}`}>&larr; Standings</Link>
      </p>
      <h1>
        Week {race.week} — {race.trackName}
      </h1>
      <p>Field size {race.fieldSize}</p>

      <Card title="Results">
        {picks.length === 0 && <p>No picks were recorded for this race.</p>}

        <table>
          <thead>
            <tr>
              <th>Player</th>
              <th>Driver</th>
              <th>Finish</th>
              <th>Base</th>
              <th>Win bonus</th>
              <th>Stage bonus</th>
              <th>Total</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {picks.map((p) => (
              <tr key={p.id} style={p.userId === userId ? { fontWeight: 700 } : undefined}>
                <td>{p.user.name ?? p.user.email}</td>
                <td>{p.driver.name}</td>
                <td>{p.score?.finishPosition ?? "—"}</td>
                <td>{p.score?.baseScore ?? "—"}</td>
                <td>{p.score?.winBonus ?? "—"}</td>
                <td>{p.score?.stageBonus ?? "—"}</td>
                <td>{p.score?.total ?? "—"}</td>
                <td>{p.score?.needsReview ? <Badge tone="warning">Flagged</Badge> : ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </main>
  );
}

async function renderTieredLineup({
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
  leagueSeason: { ruleSet: { config: unknown } };
}) {
  const config = parseTieredDraftRuleSetConfig(leagueSeason.ruleSet.config);
  const now = Date.now();
  const phase = lineupLockPhase(race, now);
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
    const myPicks = picks
      .filter((p) => p.userId === userId)
      .sort((a, b) => a.pickNumber - b.pickNumber);
    const slotByPickNumber = new Map(TIERED_LINEUP_SLOTS.map((s) => [s.pickNumber, s]));

    return (
      <main>
        <LiveRefresh />
        <p>
          <Link href={`/leagues/${leagueId}`}>&larr; Standings</Link>
        </p>
        <h1>
          Week {race.week} — {race.trackName}
        </h1>
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
      </main>
    );
  }

  if (tierAssignments.length === 0) {
    const nextCheck = nextEntryListWindowAt(new Date());
    const unlockLabel = nextCheck.toLocaleString(undefined, {
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
      <main>
        <LiveRefresh />
        <p>
          <Link href={`/leagues/${leagueId}`}>&larr; Standings</Link>
        </p>
        <h1>
          Week {race.week} — {race.trackName}
        </h1>
        <p>
          {race.venueName && <>{race.venueName} · </>}
          {new Date(race.date).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" })}
        </p>

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
      </main>
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
    <main>
      <LiveRefresh />
      <p>
        <Link href={`/leagues/${leagueId}`}>&larr; Standings</Link>
      </p>
      <h1>
        Week {race.week} — {race.trackName}
      </h1>
      <p>
        {new Date(race.date).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" })}
      </p>

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

      <Card title="Who's set a lineup">
        <ul className="rowList">
          {members.map((m) => (
            <li key={m.userId}>
              {m.user.name ?? m.user.email}
              <Badge tone={lineupSetUserIds.has(m.userId) ? "success" : "neutral"}>
                {lineupSetUserIds.has(m.userId) ? "Set" : "Not yet"}
              </Badge>
            </li>
          ))}
        </ul>
      </Card>
    </main>
  );
}
