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

  // Picks are open (and other players' driver choices stay hidden) until
  // either results come in or the race has already happened — whichever
  // comes first. Once locked, everyone's picks become visible.
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
  const avatarByUserId = new Map(members.map((m) => [m.userId, m.user.avatarUrl]));

  const myTurn = seats.find((s) => s.userId === userId);
  const onTheClockSeat = seats.find((s) => s.status === "onTheClock");
  const canPick = myTurn?.status === "picked" || myTurn?.status === "onTheClock";
  // Drivers already claimed by someone else this week aren't offered —
  // whose pick is still visibly hidden until lock, just not the name.
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
        <div className={styles.turnChips}>
          {seats.map((seat) => (
            <span
              key={seat.userId}
              className={seat.status === "onTheClock" ? `${styles.turnChip} ${styles.turnChipActive}` : styles.turnChip}
            >
              <span className={styles.turnChipPos}>{seat.position}</span>
              <UserAvatar name={nameByUserId.get(seat.userId) ?? "?"} avatarUrl={avatarByUserId.get(seat.userId)} />
              <span className={seat.userId === userId ? styles.turnChipNameBold : styles.turnChipName}>
                {nameByUserId.get(seat.userId)}
                {seat.userId === userId ? " (you)" : ""}
              </span>
              <span
                className={
                  seat.status === "picked"
                    ? styles.turnChipStatusPicked
                    : seat.status === "onTheClock"
                      ? styles.turnChipStatusActive
                      : styles.turnChipStatusWaiting
                }
              >
                {seat.status === "picked" ? "Picked" : seat.status === "onTheClock" ? "Up now" : "Waiting"}
              </span>
            </span>
          ))}
        </div>
      </div>

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
    </>
  );
}

function currentTimestamp(): number {
  return Date.now();
}
