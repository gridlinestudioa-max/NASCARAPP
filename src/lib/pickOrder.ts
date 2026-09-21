// Weekly pick order for PICKEM leagues. Tiered Lineup leagues have no
// cross-player pick restrictions (drivers are shared across tiers, not
// claimed) so none of this applies there.
//
// A league has one commissioner-set *base order* (League.pickOrder, an
// array of userIds) plus a PickOrderMode that turns that base order into
// an actual order for a given week — see computeWeekPickOrder. Within a
// week, every member picks all of their slots in one turn: the first
// member in that week's order with no pick recorded yet is "on the
// clock"; everyone after them is waiting.

export type PickOrderMode = "SNAKE" | "ROTATE" | "STANDINGS_FIRST_TO_LAST" | "STANDINGS_LAST_TO_FIRST";

export const PICK_ORDER_MODES: PickOrderMode[] = [
  "SNAKE",
  "ROTATE",
  "STANDINGS_FIRST_TO_LAST",
  "STANDINGS_LAST_TO_FIRST",
];

export const PICK_ORDER_MODE_INFO: Record<PickOrderMode, { label: string; description: string }> = {
  SNAKE: {
    label: "Snake",
    description: "Order reverses every week — whoever picks last this week picks first next week.",
  },
  ROTATE: {
    label: "Rotate",
    description: "Same direction every week, shifted by one spot — whoever picks first this week picks last next week.",
  },
  STANDINGS_FIRST_TO_LAST: {
    label: "Standings — leader picks first",
    description: "Whoever's ahead in the standings entering the week picks first.",
  },
  STANDINGS_LAST_TO_FIRST: {
    label: "Standings — last place picks first",
    description: "Whoever's behind in the standings entering the week picks first, like a draft order.",
  },
};

// Reconciles a league's stored base order (raw JSON off League.pickOrder)
// against current membership: drops anyone no longer in the league, and
// appends anyone missing from the stored order — a brand-new member, or a
// league that's never had an order set at all — in join order.
export function sanitizePickOrder(stored: unknown, joinOrderUserIds: string[]): string[] {
  const storedIds = Array.isArray(stored) ? stored.filter((id): id is string => typeof id === "string") : [];
  const memberSet = new Set(joinOrderUserIds);
  const kept = storedIds.filter((id) => memberSet.has(id));
  const keptSet = new Set(kept);
  const missing = joinOrderUserIds.filter((id) => !keptSet.has(id));
  return [...kept, ...missing];
}

// This week's pick order. `week` is the race's week number — used to
// alternate (SNAKE) or shift (ROTATE) deterministically. `pointsBeforeWeek`
// (userId -> cumulative points scored before this week) is only consulted
// for the STANDINGS modes; ties — including week 1, where everyone's at
// 0 — fall back to position in the base order.
export function computeWeekPickOrder(
  mode: PickOrderMode,
  baseOrder: string[],
  week: number,
  pointsBeforeWeek?: Map<string, number>,
): string[] {
  if (baseOrder.length === 0) return [];

  if (mode === "SNAKE") {
    return week % 2 === 0 ? [...baseOrder].reverse() : baseOrder;
  }
  if (mode === "ROTATE") {
    const shift = (week - 1) % baseOrder.length;
    return [...baseOrder.slice(shift), ...baseOrder.slice(0, shift)];
  }

  const baseIndex = new Map(baseOrder.map((id, i) => [id, i]));
  const points = pointsBeforeWeek ?? new Map<string, number>();
  return [...baseOrder].sort((a, b) => {
    const diff = (points.get(b) ?? 0) - (points.get(a) ?? 0);
    if (diff !== 0) return mode === "STANDINGS_FIRST_TO_LAST" ? diff : -diff;
    return (baseIndex.get(a) ?? 0) - (baseIndex.get(b) ?? 0);
  });
}

export type PickOrderSeat = { userId: string; position: number; status: "picked" | "onTheClock" | "waiting" };

export function computePickOrderSeats(weekOrder: string[], pickedUserIds: Set<string>): PickOrderSeat[] {
  let clockAssigned = false;
  return weekOrder.map((userId, i) => {
    if (pickedUserIds.has(userId)) return { userId, position: i + 1, status: "picked" as const };
    if (!clockAssigned) {
      clockAssigned = true;
      return { userId, position: i + 1, status: "onTheClock" as const };
    }
    return { userId, position: i + 1, status: "waiting" as const };
  });
}

export function onTheClockUserId(weekOrder: string[], pickedUserIds: Set<string>): string | null {
  return weekOrder.find((id) => !pickedUserIds.has(id)) ?? null;
}
