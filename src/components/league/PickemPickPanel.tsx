import { prisma } from "@/lib/prisma";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import UserAvatar from "@/components/ui/UserAvatar";
import { parseRuleSetConfig, pickemLockAt } from "@/lib/scoring";
import { PICK_ORDER_MODE_INFO, computePickOrderSeats, computeWeekPickOrder, sanitizePickOrder, type PickOrderMode } from "@/lib/pickOrder";
import PickForm from "@/app/leagues/[leagueId]/races/[raceId]/PickForm";
import styles from "./PickemPickPanel.module.css";

// The pick'em pick/results experience for one race — shared by the
// standalone /leagues/[leagueId]/races/[raceId] page (any week) and the
// league hub's default "Pick" tab (always the next open race), so the
// real pick-order/lock/scoring logic only lives in one place.
export default async function PickemPickPanel({
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
    league: { name: string; pickOrderMode: string; pickOrder: unknown };
  };
}) {
  const config = parseRuleSetConfig(leagueSeason.ruleSet.config);

  const picks = await prisma.pick.findMany({
    where: { leagueId, raceId },
    include: { user: true, driver: true, score: true },
    orderBy: [{ score: { total: "desc" } }, { pickNumber: "asc" }],
  });

  // Picks are open until either results come in or the race has already
  // happened — whichever comes first. Once locked, scores join the view
  // below (everyone's picks are already visible in the turn order above
  // as soon as they pick, open or locked).
  const hasResults = picks.some((p) => p.score);
  const isOpenForPicks = !hasResults && pickemLockAt(race, config.lockTiming).getTime() > currentTimestamp();

  if (!isOpenForPicks) {
    return (
      <Card title="Results">
        {picks.length === 0 ? (
          <p>No picks were recorded for this race.</p>
        ) : (
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
                  <td>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: "8px" }}>
                      <UserAvatar name={p.user.name ?? p.user.email} avatarUrl={p.user.avatarUrl} />
                      {p.user.name ?? p.user.email}
                    </span>
                  </td>
                  <td>{p.driver.name}</td>
                  <td>{p.score?.finishPosition ?? "—"}</td>
                  <td>{p.score?.baseScore ?? "—"}</td>
                  <td>{p.score?.winBonus ?? "—"}</td>
                  <td>{p.score?.stageBonus ?? "—"}</td>
                  <td className={styles.totalCell}>{p.score?.total ?? "—"}</td>
                  <td>{p.score?.needsReview ? <Badge tone="warning">Flagged</Badge> : ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    );
  }

  const [members, entries, allActiveDrivers, joinOrderMemberships, myAllPicks] = await Promise.all([
    prisma.leagueMembership.findMany({ where: { leagueId }, include: { user: true } }),
    prisma.raceEntry.findMany({ where: { raceId }, include: { driver: true }, orderBy: { driver: { name: "asc" } } }),
    prisma.driver.findMany({ where: { isActive: true }, orderBy: { name: "asc" } }),
    prisma.leagueMembership.findMany({ where: { leagueId }, orderBy: { createdAt: "asc" }, select: { userId: true } }),
    prisma.pick.findMany({ where: { leagueId, userId, race: { seasonId: race.seasonId } }, include: { driver: true } }),
  ]);

  const topDriverCounts = new Map<string, number>();
  for (const p of myAllPicks) {
    topDriverCounts.set(p.driver.name, (topDriverCounts.get(p.driver.name) ?? 0) + 1);
  }
  const topDrivers = [...topDriverCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4);
  const maxTopDriverCount = Math.max(0, ...topDrivers.map(([, count]) => count));
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
  const avatarByUserId = new Map(members.map((m) => [m.userId, m.user.avatarUrl]));

  // What each player already picked this week, in slot order — shown next
  // to their row once it's their turn's done, so you can see the board as
  // it fills in rather than just who's "Picked" with no detail.
  const pickedDriverNamesByUserId = new Map<string, string[]>();
  for (const p of [...picks].sort((a, b) => a.pickNumber - b.pickNumber)) {
    const names = pickedDriverNamesByUserId.get(p.userId) ?? [];
    names.push(p.driver.name);
    pickedDriverNamesByUserId.set(p.userId, names);
  }

  const myTurn = seats.find((s) => s.userId === userId);
  const onTheClockSeat = seats.find((s) => s.status === "onTheClock");
  const canPick = myTurn?.status === "picked" || myTurn?.status === "onTheClock";
  // Drivers already claimed by someone else this week aren't offered.
  const takenByOthersIds = new Set(picks.filter((p) => p.userId !== userId).map((p) => p.driverId));
  const drivers = allDrivers.filter((d) => !takenByOthersIds.has(d.id));
  const takenDriverNames = allDrivers.filter((d) => takenByOthersIds.has(d.id)).map((d) => d.name);

  return (
    <>
      <div className={styles.turnBanner}>
        <div className={styles.turnBannerHead}>
          <p className={styles.turnBannerUpNow} style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span className={styles.turnBannerLabel}>Up now:</span>
            {onTheClockSeat ? (
              <span style={{ display: "inline-flex", alignItems: "center", gap: "8px" }}>
                <UserAvatar name={nameByUserId.get(onTheClockSeat.userId) ?? "?"} avatarUrl={avatarByUserId.get(onTheClockSeat.userId)} size="md" />
                {nameByUserId.get(onTheClockSeat.userId)}
              </span>
            ) : (
              "All picks in"
            )}
          </p>
          <p className={styles.turnBannerMeta}>
            {PICK_ORDER_MODE_INFO[pickOrderMode].label} order · pick {onTheClockSeat ? onTheClockSeat.position : seats.length} of {seats.length}
          </p>
        </div>
        <div className={styles.turnTable}>
          {seats.map((seat) => {
            const pickedNames = pickedDriverNamesByUserId.get(seat.userId);
            return (
              <div
                key={seat.userId}
                className={seat.status === "onTheClock" ? `${styles.turnRow} ${styles.turnRowActive}` : styles.turnRow}
              >
                <span className={styles.turnRowPos}>{seat.position}</span>
                <span className={styles.turnRowPlayer}>
                  <UserAvatar name={nameByUserId.get(seat.userId) ?? "?"} avatarUrl={avatarByUserId.get(seat.userId)} />
                  <span className={seat.userId === userId ? styles.turnRowNameBold : styles.turnRowName}>
                    {nameByUserId.get(seat.userId)}
                    {seat.userId === userId ? " (you)" : ""}
                  </span>
                </span>
                <span className={styles.turnRowRight}>
                  {seat.status === "picked" && pickedNames && pickedNames.length > 0 && (
                    <span className={styles.turnRowPick}>{pickedNames.join(", ")}</span>
                  )}
                  <span
                    className={
                      seat.status === "picked"
                        ? styles.turnStatusPicked
                        : seat.status === "onTheClock"
                          ? styles.turnStatusActive
                          : styles.turnStatusWaiting
                    }
                  >
                    {seat.status === "picked" ? "Picked" : seat.status === "onTheClock" ? "Up now" : "Waiting"}
                  </span>
                </span>
              </div>
            );
          })}
        </div>
      </div>

      <div className={styles.pickRow}>
        {canPick ? (
          <Card title={myPicks.length > 0 ? "Your pick" : "Make your pick"} className={styles.pickCard}>
            <PickForm
              leagueId={leagueId}
              raceId={raceId}
              drivers={drivers}
              picksPerWeek={config.picksPerWeek}
              currentDriverIdBySlot={currentDriverIdBySlot}
            />
          </Card>
        ) : (
          <Card title="Waiting for your turn" className={styles.pickCard}>
            <p>
              {onTheClockSeat
                ? `${nameByUserId.get(onTheClockSeat.userId) ?? "Another player"} is on the clock. You're up at position ${myTurn?.position}.`
                : "Waiting for the pick order to open up."}
            </p>
          </Card>
        )}

        <Card title="Your Top Picks" className={styles.topPicksCard}>
          {topDrivers.length === 0 ? (
            <p className={styles.topPicksEmpty}>You haven&apos;t made a pick yet this season.</p>
          ) : (
            <div className={styles.topDriversList}>
              {topDrivers.map(([name, count]) => (
                <div key={name} className={styles.topDriverRow}>
                  <div className={styles.topDriverLabelRow}>
                    <span className={styles.topDriverName}>{name}</span>
                    <span className={styles.topDriverCount}>{count}×</span>
                  </div>
                  <div className={styles.topDriverTrack}>
                    <div
                      className={styles.topDriverFill}
                      style={{ width: `${maxTopDriverCount > 0 ? (count / maxTopDriverCount) * 100 : 0}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {takenDriverNames.length > 0 && (
        <Card title="Drivers taken this week">
          <ul className="rowList">
            {takenDriverNames.map((name) => (
              <li key={name}>{name}</li>
            ))}
          </ul>
        </Card>
      )}
    </>
  );
}

function currentTimestamp(): number {
  return Date.now();
}
