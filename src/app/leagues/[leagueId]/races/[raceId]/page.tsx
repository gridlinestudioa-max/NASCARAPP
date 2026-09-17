import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { parseRuleSetConfig, pickemLockAt } from "@/lib/scoring";
import {
  TIERED_LINEUP_SLOTS,
  lineupLockPhase,
  parseTieredDraftRuleSetConfig,
  type DriverTier,
} from "@/lib/tieredDraft";
import PickForm from "./PickForm";
import TieredLineupForm from "./TieredLineupForm";

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
    return renderTieredLineup({
      leagueId,
      raceId,
      userId,
      race,
      leagueSeason,
      isOwner: membership.role === "OWNER",
    });
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
  race: { week: number; trackName: string; date: Date; qualifyingAt: Date | null; fieldSize: number };
  leagueSeason: { ruleSet: { config: unknown } };
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
    const [members, drivers] = await Promise.all([
      prisma.leagueMembership.findMany({ where: { leagueId }, include: { user: true } }),
      prisma.driver.findMany({ where: { isActive: true }, orderBy: { name: "asc" } }),
    ]);
    const myPicks = picks.filter((p) => p.userId === userId).sort((a, b) => a.pickNumber - b.pickNumber);
    const currentDriverIdBySlot = Array.from(
      { length: config.picksPerWeek },
      (_, i) => myPicks.find((p) => p.pickNumber === i + 1)?.driverId ?? null,
    );
    const pickedUserIds = new Set(picks.map((p) => p.userId));

    return (
      <main>
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

        <h2>{myPicks.length > 0 ? "Your pick" : "Make your pick"}</h2>
        <PickForm
          leagueId={leagueId}
          raceId={raceId}
          drivers={drivers}
          picksPerWeek={config.picksPerWeek}
          currentDriverIdBySlot={currentDriverIdBySlot}
        />

        <h2>Who&apos;s picked</h2>
        <ul>
          {members.map((m) => (
            <li key={m.userId}>
              {m.user.name ?? m.user.email} — {pickedUserIds.has(m.userId) ? "picked" : "not yet"}
            </li>
          ))}
        </ul>
      </main>
    );
  }

  return (
    <main>
      <p>
        <Link href={`/leagues/${leagueId}`}>&larr; Standings</Link>
      </p>
      <h1>
        Week {race.week} — {race.trackName}
      </h1>
      <p>Field size {race.fieldSize}</p>

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
            <tr key={p.id} style={p.userId === userId ? { fontWeight: "bold" } : undefined}>
              <td>{p.user.name ?? p.user.email}</td>
              <td>{p.driver.name}</td>
              <td>{p.score?.finishPosition ?? "—"}</td>
              <td>{p.score?.baseScore ?? "—"}</td>
              <td>{p.score?.winBonus ?? "—"}</td>
              <td>{p.score?.stageBonus ?? "—"}</td>
              <td>{p.score?.total ?? "—"}</td>
              <td>{p.score?.needsReview ? "flagged" : ""}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}

async function renderTieredLineup({
  leagueId,
  raceId,
  userId,
  race,
  leagueSeason,
  isOwner,
}: {
  leagueId: string;
  raceId: string;
  userId: string;
  race: { week: number; trackName: string; date: Date; qualifyingAt: Date | null; seasonId: string; status: string };
  leagueSeason: { ruleSet: { config: unknown } };
  isOwner: boolean;
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
        <p>
          <Link href={`/leagues/${leagueId}`}>&larr; Standings</Link>
        </p>
        <h1>
          Week {race.week} — {race.trackName}
        </h1>
        <p>{phase === "locked" ? "Lineups are locked for this race." : "Results are in for this race."}</p>

        <h2>Your lineup</h2>
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

        <h2>Team totals this week</h2>
        <ul>
          {members
            .map((m) => ({ name: m.user.name ?? m.user.email, total: totalByUserId.get(m.userId) ?? 0 }))
            .sort((a, b) => b.total - a.total)
            .map((m) => (
              <li key={m.name}>
                {m.name} — {m.total}
              </li>
            ))}
        </ul>
      </main>
    );
  }

  if (tierAssignments.length === 0) {
    return (
      <main>
        <p>
          <Link href={`/leagues/${leagueId}`}>&larr; Standings</Link>
        </p>
        <h1>
          Week {race.week} — {race.trackName}
        </h1>
        <p>
          Tiers haven&apos;t been assigned for this race yet.
          {isOwner && (
            <>
              {" "}
              <Link href={`/races/${raceId}/tiers`}>Assign tiers</Link>.
            </>
          )}
        </p>
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

  const [myPicks, seasonRaces, members] = await Promise.all([
    prisma.pick.findMany({ where: { leagueId, userId, raceId } }),
    prisma.race.findMany({ where: { seasonId: race.seasonId, id: { not: raceId } }, select: { id: true } }),
    prisma.leagueMembership.findMany({ where: { leagueId }, include: { user: true } }),
  ]);

  const starterSlotNumbers = TIERED_LINEUP_SLOTS.filter((s) => s.role === "STARTER").map((s) => s.pickNumber);
  const priorStarterPicks = await prisma.pick.findMany({
    where: { leagueId, userId, raceId: { in: seasonRaces.map((r) => r.id) }, pickNumber: { in: starterSlotNumbers } },
  });
  const startsUsedByDriverId = new Map<string, number>();
  for (const p of priorStarterPicks) {
    startsUsedByDriverId.set(p.driverId, (startsUsedByDriverId.get(p.driverId) ?? 0) + 1);
  }
  const driversByTier: Record<DriverTier, { id: string; name: string; startsUsed: number }[]> = {
    A: driverNamesByTier.A.map((d) => ({ ...d, startsUsed: startsUsedByDriverId.get(d.id) ?? 0 })),
    B: driverNamesByTier.B.map((d) => ({ ...d, startsUsed: startsUsedByDriverId.get(d.id) ?? 0 })),
    C: driverNamesByTier.C.map((d) => ({ ...d, startsUsed: startsUsedByDriverId.get(d.id) ?? 0 })),
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
      <p>
        <Link href={`/leagues/${leagueId}`}>&larr; Standings</Link>
      </p>
      <h1>
        Week {race.week} — {race.trackName}
      </h1>
      <p>
        {new Date(race.date).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" })}
      </p>

      <h2>Your lineup</h2>
      <TieredLineupForm
        leagueId={leagueId}
        raceId={raceId}
        lockPhase={phase}
        maxStartsPerDriverPerSeason={config.maxStartsPerDriverPerSeason}
        driversByTier={driversByTier}
        currentDriverIdByPickNumber={currentDriverIdByPickNumber}
        usingCarriedOverPreview={usingCarriedOverPreview}
      />

      <h2>Who&apos;s set a lineup</h2>
      <ul>
        {members.map((m) => (
          <li key={m.userId}>
            {m.user.name ?? m.user.email} — {lineupSetUserIds.has(m.userId) ? "set" : "not yet"}
          </li>
        ))}
      </ul>
    </main>
  );
}
