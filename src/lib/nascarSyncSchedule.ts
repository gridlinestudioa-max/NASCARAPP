// Shared time-window math for when NASCAR actually publishes new data —
// used by the sync route (src/app/api/cron/sync-nascar/route.ts) to decide
// when to call the feed, and by any UI that wants to explain *why* a race
// isn't populated yet and *when* to expect it (e.g. a Tiered Lineup race
// with no entry list synced, so tiers can't be assigned yet).
//
// All times below are fixed UTC-5, not DST-aware, per how NASCAR's publish
// cadence was originally specified: entry list Tuesday and Friday ~noon.

const HOUR_MS = 60 * 60 * 1000;
const UTC_MINUS_5_OFFSET_MS = 5 * HOUR_MS;
// Generous relative to the sync tick interval, so a late-firing or missed
// tick still lands inside the window instead of skipping it.
export const ENTRY_WINDOW_MINUTES = 90;

function shiftToUtcMinus5(date: Date): Date {
  return new Date(date.getTime() - UTC_MINUS_5_OFFSET_MS);
}

export function isEntryListWindow(now: Date): boolean {
  const shifted = shiftToUtcMinus5(now);
  const dayOfWeek = shifted.getUTCDay(); // 2 = Tuesday, 5 = Friday
  const minutesSinceMidnight = shifted.getUTCHours() * 60 + shifted.getUTCMinutes();
  const minutesSinceNoon = minutesSinceMidnight - 12 * 60;
  return (dayOfWeek === 2 || dayOfWeek === 5) && minutesSinceNoon >= 0 && minutesSinceNoon < ENTRY_WINDOW_MINUTES;
}

// The next moment (at or after `now`) that the entry-list window opens —
// purely for display ("we'll check again around ..."); the route above
// doesn't need this, it just checks isEntryListWindow on every tick.
export function nextEntryListWindowAt(now: Date): Date {
  const shiftedNow = shiftToUtcMinus5(now);
  for (let i = 0; i < 8; i++) {
    const candidateShifted = new Date(
      Date.UTC(shiftedNow.getUTCFullYear(), shiftedNow.getUTCMonth(), shiftedNow.getUTCDate() + i, 12, 0, 0),
    );
    const dayOfWeek = candidateShifted.getUTCDay();
    if (dayOfWeek !== 2 && dayOfWeek !== 5) continue;
    const candidateReal = new Date(candidateShifted.getTime() + UTC_MINUS_5_OFFSET_MS);
    if (candidateReal.getTime() >= now.getTime()) return candidateReal;
  }
  // Unreachable — every 7-day span contains a Tuesday and a Friday.
  return now;
}
