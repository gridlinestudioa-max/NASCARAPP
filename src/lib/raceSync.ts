// Shared "apply results to the database" logic, used identically whether
// the data came from a commissioner's manual entry form or an automated
// NASCAR feed sync — same upserts, same scoring, same shared-across-every-
// league semantics either way.

import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { computeScore, parseRuleSetConfig } from "@/lib/scoring";
import {
  materializeCarriedOverLineups,
  parseTieredDraftRuleSetConfig,
  scoreTieredFinish,
  scoreTieredQualifying,
} from "@/lib/tieredDraft";
import {
  fetchSeasonRaceList,
  fetchWeekendFeed,
  matchByNameAndDate,
  matchScheduleEntry,
  parseWeekendData,
} from "@/lib/nascarFeed";

type RaceForScoring = { id: string; seasonId: string; fieldSize: number; isNonPoints: boolean };

export async function applyQualifyingResults(
  tx: Prisma.TransactionClient,
  race: Pick<RaceForScoring, "id" | "seasonId">,
  qualifyingPositions: Map<string, number>,
): Promise<void> {
  for (const [driverId, qualifyingPosition] of qualifyingPositions) {
    await tx.qualifyingResult.upsert({
      where: { raceId_driverId: { raceId: race.id, driverId } },
      update: { qualifyingPosition },
      create: { raceId: race.id, driverId, qualifyingPosition },
    });
  }

  const tieredLeagueSeasons = await tx.leagueSeason.findMany({
    where: { seasonId: race.seasonId, league: { type: "TIERED_DRAFT" } },
    include: { ruleSet: true },
  });
  const configByLeagueId = new Map(
    tieredLeagueSeasons.map((ls) => [ls.leagueId, parseTieredDraftRuleSetConfig(ls.ruleSet.config)]),
  );
  await scoreTieredQualifying(tx, race.id, qualifyingPositions, configByLeagueId);
}

export async function applyRaceResults(
  tx: Prisma.TransactionClient,
  race: RaceForScoring,
  finishPositions: Map<string, number>,
  stage1Positions: Map<string, number>,
  stage2Positions: Map<string, number>,
  options?: { dnfByDriverId?: Map<string, boolean>; lapsLedByDriverId?: Map<string, number> },
): Promise<void> {
  const dnfByDriverId = options?.dnfByDriverId ?? new Map<string, boolean>();
  const lapsLedByDriverId = options?.lapsLedByDriverId ?? new Map<string, number>();

  for (const [driverId, finishPosition] of finishPositions) {
    const dnf = dnfByDriverId.get(driverId) ?? false;
    const lapsLed = lapsLedByDriverId.get(driverId) ?? null;
    await tx.raceResult.upsert({
      where: { raceId_driverId: { raceId: race.id, driverId } },
      update: { finishingPosition: finishPosition, dnf, lapsLed },
      create: { raceId: race.id, driverId, finishingPosition: finishPosition, dnf, lapsLed },
    });

    for (const [stageNumber, stagePositions] of [
      [1, stage1Positions],
      [2, stage2Positions],
    ] as const) {
      const position = stagePositions.get(driverId);
      if (position != null) {
        await tx.stageResult.upsert({
          where: { raceId_stageNumber_driverId: { raceId: race.id, stageNumber, driverId } },
          update: { position },
          create: { raceId: race.id, stageNumber, position, driverId },
        });
      } else {
        await tx.stageResult.deleteMany({ where: { raceId: race.id, stageNumber, driverId } });
      }
    }
  }

  // Before scoring, make sure every Tiered Lineup member who never
  // touched their lineup this week has one carried forward from their
  // last set lineup — otherwise they'd silently score nothing.
  await materializeCarriedOverLineups(tx, race.id);

  // Results are shared data — recompute scores for every league's picks
  // on this race, not just whichever league prompted the sync/entry.
  // Pick'em and Tiered Lineup leagues score under entirely different
  // formulas, so they're handled separately.
  const picks = await tx.pick.findMany({
    where: { raceId: race.id, driverId: { in: [...finishPositions.keys()] } },
    include: { league: true },
  });

  const pickemLeagueIds = [...new Set(picks.filter((p) => p.league.type === "PICKEM").map((p) => p.leagueId))];
  const pickemLeagueSeasons = await tx.leagueSeason.findMany({
    where: { leagueId: { in: pickemLeagueIds }, seasonId: race.seasonId },
    include: { ruleSet: true },
  });
  const pickemConfigByLeagueId = new Map(
    pickemLeagueSeasons.map((ls) => [ls.leagueId, parseRuleSetConfig(ls.ruleSet.config)]),
  );

  for (const pick of picks) {
    if (pick.league.type !== "PICKEM") continue;
    const config = pickemConfigByLeagueId.get(pick.leagueId);
    if (!config) continue;
    // A league that didn't opt into non-points races doesn't score picks
    // on one at all, rather than scoring them as 0 — they just stay
    // unscored, same as a race that hasn't happened yet.
    if (race.isNonPoints && !config.includeNonPointsRaces) continue;

    const finishPosition = finishPositions.get(pick.driverId)!;
    const stagePositions = [stage1Positions.get(pick.driverId), stage2Positions.get(pick.driverId)].filter(
      (p): p is number => p != null,
    );
    const score = computeScore(finishPosition, race.fieldSize, stagePositions, config);
    await tx.score.upsert({
      where: { pickId: pick.id },
      update: { finishPosition, ...score, needsReview: false },
      create: { pickId: pick.id, finishPosition, ...score, needsReview: false },
    });
  }

  const tieredLeagueIds = [...new Set(picks.filter((p) => p.league.type === "TIERED_DRAFT").map((p) => p.leagueId))];
  const tieredLeagueSeasons = await tx.leagueSeason.findMany({
    where: { leagueId: { in: tieredLeagueIds }, seasonId: race.seasonId },
    include: { ruleSet: true },
  });
  const tieredConfigByLeagueId = new Map(
    tieredLeagueSeasons.map((ls) => [ls.leagueId, parseTieredDraftRuleSetConfig(ls.ruleSet.config)]),
  );
  await scoreTieredFinish(tx, race.id, finishPositions, tieredConfigByLeagueId);

  await tx.race.update({ where: { id: race.id }, data: { status: "COMPLETE" } });
}

// Upserts the announced field for a race week. Auto-creates any Driver
// row that doesn't already exist by name (the entry list is the
// authoritative source of truth for "who's racing" — new drivers show up
// here before anywhere else in the app).
export async function applyRaceEntries(
  tx: Prisma.TransactionClient,
  raceId: string,
  entries: { driverName: string; carNumber: number | null; teamName?: string | null; manufacturer?: string | null }[],
): Promise<Map<string, string>> {
  const driverIdByName = new Map<string, string>();
  for (const entry of entries) {
    const driver = await tx.driver.upsert({
      where: { name: entry.driverName },
      update: {},
      create: { name: entry.driverName },
    });
    driverIdByName.set(entry.driverName, driver.id);
    await tx.raceEntry.upsert({
      where: { raceId_driverId: { raceId, driverId: driver.id } },
      update: { carNumber: entry.carNumber, teamName: entry.teamName, manufacturer: entry.manufacturer },
      create: {
        raceId,
        driverId: driver.id,
        carNumber: entry.carNumber,
        teamName: entry.teamName,
        manufacturer: entry.manufacturer,
      },
    });
  }
  return driverIdByName;
}

// ---------- Full sync orchestration ----------
//
// This is the single entry point both the manual "Sync from NASCAR"
// button and any future scheduled job (e.g. a Vercel Cron route) should
// call — it does its own fetch, so it does not take a caller-supplied
// transaction. Callers are responsible for their own authorization; this
// function assumes the caller has already confirmed the requester is
// allowed to sync this race.
export type SyncResult = { ok: true; message: string } | { ok: false; error: string };

export async function syncRaceWithNascarFeed(raceId: string): Promise<SyncResult> {
  const race = await prisma.race.findUnique({ where: { id: raceId }, include: { season: true } });
  if (!race) {
    return { ok: false, error: "Race not found." };
  }

  let nascarRaceId = race.nascarRaceId;
  if (!nascarRaceId) {
    let scheduleList;
    try {
      scheduleList = await fetchSeasonRaceList(race.season.year);
    } catch (cause) {
      return { ok: false, error: `Couldn't reach NASCAR's schedule feed: ${(cause as Error).message}` };
    }
    const candidates = scheduleList.filter((r) => r.series_id === race.nascarSeriesId);
    const match = matchScheduleEntry({ trackName: race.trackName, date: race.date }, candidates);
    if (!match) {
      return {
        ok: false,
        error:
          "Couldn't automatically match this race to a NASCAR schedule entry (track name or date didn't line up with exactly one candidate).",
      };
    }
    nascarRaceId = match.race_id;
    await prisma.race.update({ where: { id: raceId }, data: { nascarRaceId } });
  }

  let weekend;
  try {
    weekend = await fetchWeekendFeed(race.season.year, race.nascarSeriesId, nascarRaceId);
  } catch (cause) {
    return { ok: false, error: `Couldn't reach NASCAR's race feed: ${(cause as Error).message}` };
  }

  const parsed = parseWeekendData(weekend);
  if (!parsed) {
    return { ok: false, error: "NASCAR hasn't published data for this race yet." };
  }

  await prisma.$transaction(async (tx) => {
    await tx.race.update({
      where: { id: raceId },
      data: {
        lastSyncedAt: new Date(),
        ...(parsed.qualifyingAt ? { qualifyingAt: parsed.qualifyingAt } : {}),
        ...(parsed.fieldSize ? { fieldSize: parsed.fieldSize } : {}),
        ...(parsed.stage1Laps ? { stage1Length: parsed.stage1Laps } : {}),
        ...(parsed.stage2Laps ? { stage2Length: parsed.stage2Laps } : {}),
      },
    });
    // Scoring (fieldSizeRelative Pick'em mode) needs the just-synced field
    // size, not the value fetched into `race` before this update.
    const effectiveRace = { ...race, fieldSize: parsed.fieldSize ?? race.fieldSize };

    const driverIdByName = await applyRaceEntries(tx, raceId, parsed.entries);

    if (parsed.qualifying.length > 0) {
      const qualifyingPositions = new Map<string, number>();
      for (const q of parsed.qualifying) {
        const driverId = driverIdByName.get(q.driverName);
        if (driverId) qualifyingPositions.set(driverId, q.position);
      }
      if (qualifyingPositions.size > 0) {
        await applyQualifyingResults(tx, effectiveRace, qualifyingPositions);
      }
    }

    if (parsed.results.length > 0) {
      const finishPositions = new Map<string, number>();
      const dnfByDriverId = new Map<string, boolean>();
      const lapsLedByDriverId = new Map<string, number>();
      for (const r of parsed.results) {
        const driverId = driverIdByName.get(r.driverName);
        if (!driverId) continue;
        finishPositions.set(driverId, r.position);
        dnfByDriverId.set(driverId, r.dnf);
        if (r.lapsLed != null) lapsLedByDriverId.set(driverId, r.lapsLed);
      }
      const stage1Positions = new Map<string, number>();
      const stage2Positions = new Map<string, number>();
      for (const s of parsed.stageResults) {
        const driverId = driverIdByName.get(s.driverName);
        if (!driverId) continue;
        if (s.stageNumber === 1) stage1Positions.set(driverId, s.position);
        else if (s.stageNumber === 2) stage2Positions.set(driverId, s.position);
      }
      if (finishPositions.size > 0) {
        await applyRaceResults(tx, effectiveRace, finishPositions, stage1Positions, stage2Positions, {
          dnfByDriverId,
          lapsLedByDriverId,
        });
      }
    }
  });

  return {
    ok: true,
    message: `Synced: ${parsed.entries.length} entries, ${parsed.qualifying.length} qualifying positions, ${parsed.results.length} results, ${parsed.stageResults.length} stage results.`,
  };
}

// One-time (or re-runnable) backfill: matches every race in a season to
// NASCAR's own schedule and overwrites trackName with NASCAR's own event
// name (race_name — "Bass Pro Shops Night Race", not the venue's
// track_name), plus the real scheduled start time and nascarRaceId. Our
// seeded trackName data is a mix of shorthand nicknames ("Vegas") and
// approximate race/sponsor names, and our seeded date is a calendar day
// with no time-of-day — both get corrected here so the site displays
// NASCAR's own naming and every later per-race sync (plus the cron's
// start-time-relative pull windows) has an accurate name and start time
// to work from. Once nascarRaceId is set for a race, its own sync skips
// schedule matching entirely.
//
// Production turned up a case matchScheduleEntry's name/date matching
// can't handle at all: the early part of a season can be seeded with
// evenly-spaced placeholder dates (every Sunday from some guessed start)
// rather than the real ones, which land more than 3 days from every real
// candidate — no name or date signal is close enough to match on. week is
// the one field the schema documents as authoritative regardless of how
// rough the seeded date is ("dates may be estimated, week is not"), so
// each series here also tries a positional match: sort our races by week
// and NASCAR's candidates by real date, and pair them up by index plus a
// fixed offset.
//
// That offset isn't assumed to be 0 (our race count and NASCAR's real
// schedule length for a series don't have to match exactly — an event
// either side tracks that the other doesn't shifts everything after it by
// a fixed amount rather than breaking alignment). Instead it's inferred
// from whichever races already have a confident name+date match via
// matchScheduleEntry: each contributes candidateIndex - raceIndex, and
// the offset is trusted only when every one of them agrees on the same
// value. Zero confident matches, or two that disagree, means no positional
// fallback for that series at all — a coincidental date collision (an
// evenly-spaced placeholder landing within 3 days of a real but
// *different* race) would rather silently disable the fallback than let
// one bad offset misalign every race that relies on it.
export async function syncSeasonScheduleWithNascarFeed(seasonId: string): Promise<SyncResult> {
  const season = await prisma.season.findUnique({ where: { id: seasonId }, include: { races: true } });
  if (!season) {
    return { ok: false, error: "Season not found." };
  }

  let scheduleList;
  try {
    scheduleList = await fetchSeasonRaceList(season.year);
  } catch (cause) {
    return { ok: false, error: `Couldn't reach NASCAR's schedule feed: ${(cause as Error).message}` };
  }

  const matchedWeeks: number[] = [];
  const unmatchedWeeks: number[] = [];

  const racesBySeriesId = new Map<number, typeof season.races>();
  for (const race of season.races) {
    const bucket = racesBySeriesId.get(race.nascarSeriesId);
    if (bucket) bucket.push(race);
    else racesBySeriesId.set(race.nascarSeriesId, [race]);
  }

  try {
    await prisma.$transaction(async (tx) => {
      for (const [seriesId, seriesRaces] of racesBySeriesId) {
        const candidates = scheduleList.filter((r) => r.series_id === seriesId);
        const positionalCandidates = [...candidates].sort(
          (a, b) => new Date(a.race_date).getTime() - new Date(b.race_date).getTime(),
        );
        const positionalRaces = [...seriesRaces].sort((a, b) => a.week - b.week);

        // Anchors: races with a strict name+date match, trusted enough to
        // infer an offset from (see matchByNameAndDate's own reasoning for
        // why the weaker date-only fallback isn't trustworthy here).
        const nameMatchByIndex = new Map<number, (typeof positionalCandidates)[number]>();
        const offsets = new Set<number>();
        for (let i = 0; i < positionalRaces.length; i++) {
          const race = positionalRaces[i];
          const match = matchByNameAndDate({ trackName: race.trackName, date: race.date }, candidates);
          if (match) {
            nameMatchByIndex.set(i, match);
            offsets.add(positionalCandidates.indexOf(match) - i);
          }
        }
        const inferredOffset = offsets.size === 1 ? [...offsets][0] : null;

        for (let i = 0; i < positionalRaces.length; i++) {
          const race = positionalRaces[i];
          const match =
            nameMatchByIndex.get(i) ??
            (inferredOffset != null ? positionalCandidates[i + inferredOffset] : undefined) ??
            matchScheduleEntry({ trackName: race.trackName, date: race.date }, candidates);
          if (!match) {
            unmatchedWeeks.push(race.week);
            continue;
          }
          matchedWeeks.push(race.week);
          await tx.race.update({
            where: { id: race.id },
            data: { trackName: match.race_name, date: new Date(match.race_date), nascarRaceId: match.race_id },
          });
        }
      }
    });
  } catch (cause) {
    return { ok: false, error: `Failed while saving matched races: ${(cause as Error).message}` };
  }

  const unmatchedNote = unmatchedWeeks.length > 0 ? ` Unmatched: week ${unmatchedWeeks.join(", ")}.` : "";
  return {
    ok: true,
    message: `Matched ${matchedWeeks.length} of ${season.races.length} races to NASCAR's schedule.${unmatchedNote}`,
  };
}

// Catches up any race whose date has already passed but that hasn't been
// fully synced yet — entries, qualifying, finishing positions, stage
// results, and every league's scores for it. Self-limiting: once a race
// is synced its status flips to COMPLETE and lastSyncedAt is set, so it's
// skipped on every later call — safe to run on every cron tick alongside
// the current week's time-windowed sync without re-fetching old races
// over and over.
export async function syncPastRacesWithNascarFeed(seasonId: string): Promise<SyncResult> {
  const races = await prisma.race.findMany({
    where: {
      seasonId,
      date: { lte: new Date() },
      OR: [{ status: { not: "COMPLETE" } }, { lastSyncedAt: null }],
    },
    orderBy: { date: "asc" },
  });

  const synced: number[] = [];
  const failed: { week: number; error: string }[] = [];
  for (const race of races) {
    const result = await syncRaceWithNascarFeed(race.id);
    if (result.ok) synced.push(race.week);
    else failed.push({ week: race.week, error: result.error });
  }

  const failedNote =
    failed.length > 0 ? ` Failed: ${failed.map((f) => `week ${f.week} (${f.error})`).join("; ")}.` : "";
  return {
    ok: true,
    message: `Backfilled ${synced.length} of ${races.length} past races.${failedNote}`,
  };
}
