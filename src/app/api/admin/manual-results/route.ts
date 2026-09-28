import { prisma } from "@/lib/prisma";
import { applyParsedRaceData } from "@/lib/raceSync";
import { displayRaceName } from "@/lib/raceName";
import { sendManualResultsAppliedAlert } from "@/lib/email";
import type { ParsedWeekendData } from "@/lib/nascarFeed";

export const dynamic = "force-dynamic";

// Same auth model as the NASCAR sync cron route (a bearer secret, no login
// credentials involved) — this is the write path for the weekly "web
// search the results and populate them" scheduled task, for whenever the
// automatic NASCAR feed sync hasn't caught a race up (there's no reliable
// public standings API, so that task falls back to a web search). Reuses
// applyParsedRaceData, the exact same apply-to-DB code the feed sync and
// (indirectly) the admin manual-entry form both already go through — this
// route's only job is turning a web-search-shaped payload into the same
// ParsedWeekendData shape that function expects.
function unauthorized() {
  return Response.json({ error: "Unauthorized" }, { status: 401 });
}

function checkAuth(request: Request): boolean {
  const authHeader = request.headers.get("authorization");
  return Boolean(process.env.RESULTS_ENTRY_SECRET) && authHeader === `Bearer ${process.env.RESULTS_ENTRY_SECRET}`;
}

// GET: "is there a race that needs results, and what is it" — so the
// caller doesn't need to already know a raceId, and can bail out
// immediately (no web search needed) when the automatic sync already
// caught it.
export async function GET(request: Request) {
  if (!checkAuth(request)) return unauthorized();

  const race = await prisma.race.findFirst({
    where: { date: { lte: new Date() } },
    orderBy: { date: "desc" },
    select: { id: true, week: true, trackName: true, venueName: true, date: true, status: true },
  });

  if (!race) {
    return Response.json({ race: null });
  }

  return Response.json({
    race: {
      raceId: race.id,
      week: race.week,
      trackName: displayRaceName(race.trackName),
      venueName: race.venueName,
      date: race.date,
      status: race.status,
      alreadyComplete: race.status === "COMPLETE",
    },
  });
}

type ResultRow = { driverName: string; position: number; dnf?: boolean; lapsLed?: number };
type PositionRow = { driverName: string; position: number };
type EntryRow = { driverName: string; carNumber?: number; teamName?: string; manufacturer?: string };

type Body = {
  raceId?: string;
  results?: ResultRow[];
  qualifying?: PositionRow[];
  stageResults?: { stageNumber: number; driverName: string; position: number }[];
  entries?: EntryRow[];
  // Free text describing where the caller got this data (e.g. "NASCAR.com
  // official results, cross-checked with Racing-Reference.info") — included
  // in the confirmation email below so it's easy to spot-check.
  source?: string;
};

function isResultRow(v: unknown): v is ResultRow {
  if (typeof v !== "object" || v === null) return false;
  const r = v as Record<string, unknown>;
  return typeof r.driverName === "string" && r.driverName.trim() !== "" && typeof r.position === "number";
}

function isPositionRow(v: unknown): v is PositionRow {
  if (typeof v !== "object" || v === null) return false;
  const r = v as Record<string, unknown>;
  return typeof r.driverName === "string" && r.driverName.trim() !== "" && typeof r.position === "number";
}

// POST: apply a set of results (and optionally qualifying/stage results)
// found via web search to a race. `entries` is optional — every driver
// named anywhere in results/qualifying/stageResults is entered
// automatically (see applyRaceEntries, which is what actually resolves/
// creates each Driver row; results and qualifying only match against
// drivers that came through entries), so an explicit entries list is only
// needed to carry car number/team/manufacturer detail the caller happens
// to have.
export async function POST(request: Request) {
  if (!checkAuth(request)) return unauthorized();

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return Response.json({ ok: false, error: "Invalid JSON body." }, { status: 400 });
  }

  if (typeof body.raceId !== "string" || !body.raceId) {
    return Response.json({ ok: false, error: "raceId is required." }, { status: 400 });
  }
  const results = Array.isArray(body.results) ? body.results.filter(isResultRow) : [];
  if (results.length === 0) {
    return Response.json({ ok: false, error: "results must be a non-empty array of {driverName, position}." }, { status: 400 });
  }
  const qualifying = Array.isArray(body.qualifying) ? body.qualifying.filter(isPositionRow) : [];
  const stageResults = Array.isArray(body.stageResults)
    ? body.stageResults.filter(
        (s): s is { stageNumber: number; driverName: string; position: number } =>
          typeof s === "object" &&
          s !== null &&
          typeof (s as Record<string, unknown>).stageNumber === "number" &&
          isPositionRow(s),
      )
    : [];
  const explicitEntries = Array.isArray(body.entries) ? body.entries : [];

  // Union of every driver name mentioned anywhere, so results/qualifying
  // always have a matching entry regardless of whether the caller passed
  // one — see the applyRaceEntries note above.
  const entryByName = new Map<string, EntryRow>();
  for (const e of explicitEntries) {
    if (typeof e.driverName === "string" && e.driverName.trim()) entryByName.set(e.driverName, e);
  }
  for (const r of [...results, ...qualifying, ...stageResults]) {
    if (!entryByName.has(r.driverName)) entryByName.set(r.driverName, { driverName: r.driverName });
  }

  const parsed: ParsedWeekendData = {
    entries: [...entryByName.values()].map((e) => ({
      driverName: e.driverName,
      carNumber: e.carNumber ?? null,
      teamName: e.teamName ?? null,
      manufacturer: e.manufacturer ?? null,
    })),
    qualifying,
    results: results.map((r) => ({ driverName: r.driverName, position: r.position, dnf: r.dnf ?? false, lapsLed: r.lapsLed ?? null })),
    stageResults,
    fieldSize: null,
    stage1Laps: null,
    stage2Laps: null,
    qualifyingAt: null,
    venueName: null,
  };

  const result = await applyParsedRaceData(body.raceId, parsed);
  if (!result.ok) {
    return Response.json({ ok: false, error: result.error }, { status: 400 });
  }

  // Sent here rather than expecting the caller to — the admin's email
  // address is a server-side secret this route already has access to via
  // ADMIN_EMAIL, and every caller of this endpoint (today's weekly
  // web-search task, and anything else that ever posts to it) gets the
  // same confirmation without needing to know it or hold its own
  // mail-sending logic.
  const adminEmail = process.env.ADMIN_EMAIL;
  if (adminEmail) {
    const race = await prisma.race.findUnique({ where: { id: body.raceId }, select: { week: true, trackName: true } });
    if (race) {
      await sendManualResultsAppliedAlert(adminEmail, {
        week: race.week,
        trackName: displayRaceName(race.trackName),
        message: result.message,
        source: typeof body.source === "string" ? body.source : undefined,
      });
    }
  }

  return Response.json({ ok: true, message: result.message });
}
