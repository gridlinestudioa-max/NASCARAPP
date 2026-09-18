import { prisma } from "@/lib/prisma";
import {
  syncRaceWithNascarFeed,
  syncSeasonScheduleWithNascarFeed,
  syncPastRacesWithNascarFeed,
} from "@/lib/raceSync";
import { sendSyncFailureAlert } from "@/lib/email";

export const dynamic = "force-dynamic";

// This is the only path that writes schedule/entry/qualifying/result data —
// there is deliberately no admin-facing "sync now" button, so this endpoint
// (and the admin manual-entry fallback pages) are the only ways that data
// changes. It's hit every ~15 minutes by a GitHub Actions workflow
// (.github/workflows/nascar-sync.yml) rather than Vercel Cron, since Vercel
// Cron on the Hobby plan can't run more than once a day; vercel.json still
// carries one daily Vercel Cron entry hitting this same URL as a fallback in
// case the GitHub Actions workflow is ever disabled or fails. Vercel signs
// its own request with `Authorization: Bearer ${CRON_SECRET}` automatically;
// the GitHub Actions workflow sends the same header from a repo secret that
// must be kept equal to this env var by hand. Anyone else calling this URL
// gets rejected.
//
// NASCAR's real publish cadence isn't "whatever's available whenever we
// ask" — pulling constantly would hammer an undocumented, unauthenticated
// feed for no reason. Instead each tick checks real calendar/clock windows
// (all times below are fixed UTC-5, not DST-aware, per how they were
// specified) and only calls the feed when something is actually expected to
// be freshly published:
//   - entry list: Tuesday and Friday, ~noon
//   - starting grid (qualifying): the 12 hours before green flag
//   - finishing positions: every tick from 3 to 5 hours after green flag
const HOUR_MS = 60 * 60 * 1000;
const UTC_MINUS_5_OFFSET_MS = 5 * HOUR_MS;
// Generous relative to the ~15 minute tick interval, so a late-firing or
// missed tick still lands inside the window instead of skipping it.
const ENTRY_WINDOW_MINUTES = 90;

function shiftToUtcMinus5(date: Date): Date {
  return new Date(date.getTime() - UTC_MINUS_5_OFFSET_MS);
}

function isEntryListWindow(now: Date): boolean {
  const shifted = shiftToUtcMinus5(now);
  const dayOfWeek = shifted.getUTCDay(); // 2 = Tuesday, 5 = Friday
  const minutesSinceMidnight = shifted.getUTCHours() * 60 + shifted.getUTCMinutes();
  const minutesSinceNoon = minutesSinceMidnight - 12 * 60;
  return (dayOfWeek === 2 || dayOfWeek === 5) && minutesSinceNoon >= 0 && minutesSinceNoon < ENTRY_WINDOW_MINUTES;
}

// At most one admin alert email per hour, regardless of how many ticks in
// that hour keep failing — a persistent outage should say "something's
// wrong" once, not resend every ~15 minutes until someone notices.
const ALERT_THROTTLE_MS = 60 * 60 * 1000;

async function maybeSendFailureAlert(failures: string[]): Promise<void> {
  if (failures.length === 0) return;
  const adminEmail = process.env.ADMIN_EMAIL;
  if (!adminEmail) return;

  const state = await prisma.syncAlertState.upsert({
    where: { id: "singleton" },
    update: {},
    create: { id: "singleton" },
  });
  if (state.lastAlertedAt && Date.now() - state.lastAlertedAt.getTime() < ALERT_THROTTLE_MS) {
    return;
  }

  await prisma.syncAlertState.update({ where: { id: "singleton" }, data: { lastAlertedAt: new Date() } });
  await sendSyncFailureAlert(adminEmail, failures.join("\n\n"));
}

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();

  try {
    // The "focus" race: whichever race is soonest but not more than 5 hours
    // in the past — covers both "next upcoming race" (for entries/qualifying)
    // and "the race that just happened" (for the results window) with one
    // query, since a race more than 5 hours past its start rolls over to the
    // next one automatically.
    const race = await prisma.race.findFirst({
      where: { date: { gte: new Date(now.getTime() - 5 * HOUR_MS) } },
      orderBy: { date: "asc" },
      include: { season: true },
    });

    if (!race) {
      return Response.json({ ok: true, message: "No race in range to sync." });
    }

    const msUntilStart = race.date.getTime() - now.getTime();
    const msSinceStart = now.getTime() - race.date.getTime();
    const dueForEntries = isEntryListWindow(now);
    const dueForQualifying = msUntilStart > 0 && msUntilStart <= 12 * HOUR_MS;
    const dueForResults = msSinceStart >= 3 * HOUR_MS && msSinceStart <= 5 * HOUR_MS;

    // Cheap (one extra fetch) and keeps every race's trackName/date/
    // nascarRaceId accurate site-wide — gated to the entry-list window so it
    // doesn't fire on every 15-minute tick all week for no reason.
    const scheduleResult = dueForEntries ? await syncSeasonScheduleWithNascarFeed(race.seasonId) : null;

    // Self-limiting (see syncPastRacesWithNascarFeed) — safe to attempt on
    // every tick.
    const backfillResult = await syncPastRacesWithNascarFeed(race.seasonId);

    const raceResult =
      dueForEntries || dueForQualifying || dueForResults ? await syncRaceWithNascarFeed(race.id) : null;

    const failures: string[] = [];
    if (scheduleResult && !scheduleResult.ok) failures.push(`Schedule sync: ${scheduleResult.error}`);
    if (raceResult && !raceResult.ok) failures.push(`Race sync (week ${race.week}, ${race.trackName}): ${raceResult.error}`);
    if (!backfillResult.ok) failures.push(`Past-race backfill: ${backfillResult.error}`);
    else if (backfillResult.message.includes("Failed:")) failures.push(`Past-race backfill: ${backfillResult.message}`);
    await maybeSendFailureAlert(failures);

    return Response.json({
      raceId: race.id,
      week: race.week,
      trackName: race.trackName,
      windows: { dueForEntries, dueForQualifying, dueForResults },
      schedule: scheduleResult,
      backfill: backfillResult,
      race: raceResult,
    });
  } catch (cause) {
    const message = (cause as Error).message;
    await maybeSendFailureAlert([`Unhandled error in the sync route: ${message}`]);
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
}
