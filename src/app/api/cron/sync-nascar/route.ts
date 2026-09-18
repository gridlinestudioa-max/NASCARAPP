import { prisma } from "@/lib/prisma";
import { syncRaceWithNascarFeed, syncSeasonScheduleWithNascarFeed } from "@/lib/raceSync";

export const dynamic = "force-dynamic";

// Vercel Cron hits this 4x/week (see vercel.json) to pull whatever NASCAR
// has published so far for the soonest race that hasn't happened yet —
// entry list, qualifying, and results all come from the same feed call,
// so running this repeatedly through the week naturally picks each one up
// as it becomes available, with no separate cron per data type. This is
// the only path that writes schedule/entry/qualifying/result data now —
// there is deliberately no admin-facing "sync now" button, so this
// endpoint (and the admin manual-entry fallback pages) are the only ways
// that data changes. Vercel signs the request with
// `Authorization: Bearer ${CRON_SECRET}` automatically once that env var
// is set, so anyone else calling this URL gets rejected.
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const race = await prisma.race.findFirst({
    where: { status: "SCHEDULED", date: { gte: new Date() } },
    orderBy: { date: "asc" },
    include: { season: true },
  });

  if (!race) {
    return Response.json({ ok: true, message: "No upcoming race to sync." });
  }

  // Cheap (one extra fetch) and keeps every race's trackName/nascarRaceId
  // accurate site-wide, not just the one race being synced below — worth
  // doing on every tick rather than as a separate schedule.
  const scheduleResult = await syncSeasonScheduleWithNascarFeed(race.seasonId);
  const raceResult = await syncRaceWithNascarFeed(race.id);

  return Response.json({
    raceId: race.id,
    week: race.week,
    trackName: race.trackName,
    schedule: scheduleResult,
    race: raceResult,
  });
}
