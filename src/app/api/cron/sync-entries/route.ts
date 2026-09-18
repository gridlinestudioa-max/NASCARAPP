import { prisma } from "@/lib/prisma";
import { syncRaceWithNascarFeed } from "@/lib/raceSync";

export const dynamic = "force-dynamic";

// Vercel Cron hits this on a schedule (see vercel.json) to pull the
// entry list (and whatever else is published) for the soonest race that
// hasn't happened yet — the same sync a commissioner can trigger by hand
// from that race's page, just on autopilot. Vercel signs the request with
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
  });

  if (!race) {
    return Response.json({ ok: true, message: "No upcoming race to sync." });
  }

  const result = await syncRaceWithNascarFeed(race.id);

  return Response.json({
    raceId: race.id,
    week: race.week,
    trackName: race.trackName,
    ...result,
  });
}
