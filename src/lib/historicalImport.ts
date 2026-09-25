// One-time (repeatable) backfill of pre-app-history race results, so the
// auto-tier formula's "track history" component has real signal from day
// one instead of starting neutral for every driver. Pulls straight from
// the same NASCAR feed the live sync uses — see nascarFeed.ts — just for
// past years. Writes into HistoricalRaceResult, deliberately never Race/
// RaceResult (see that model's schema comment for why).
//
// Self-limiting and idempotent by design, same philosophy as
// syncPastRacesWithNascarFeed: one call processes a bounded batch of
// races and reports how much is left, so a commissioner can click
// "Import next batch" repeatedly (each call comfortably fits Vercel's
// function timeout) without risking a duplicate write if a batch is
// re-run — already-imported (year, trackName) pairs are skipped.

import { prisma } from "@/lib/prisma";
import { CUP_SERIES_ID, fetchSeasonRaceList, fetchWeekendFeed, parseWeekendData } from "@/lib/nascarFeed";
import { getCurrentSeason } from "@/lib/season";
import { findOrCreateDriverByName } from "@/lib/driverMatch";

const HISTORICAL_YEARS_BACK = 8;
const HISTORICAL_IMPORT_BATCH_SIZE = 10;

export type HistoricalImportOutcome = { ok: true; message: string } | { ok: false; error: string };

// The 8 seasons immediately before the site's own current season, e.g.
// 2018-2025 when the current season is 2026 — recomputed from the DB
// rather than hardcoded so this doesn't quietly go stale year to year.
async function targetYears(): Promise<number[] | null> {
  const currentSeason = await getCurrentSeason();
  if (!currentSeason) return null;
  return Array.from({ length: HISTORICAL_YEARS_BACK }, (_, i) => currentSeason.year - HISTORICAL_YEARS_BACK + i);
}

export async function importHistoricalResults(): Promise<HistoricalImportOutcome> {
  const years = await targetYears();
  if (!years) return { ok: false, error: "No season set up yet." };

  const alreadyImported = await prisma.historicalRaceResult.findMany({
    select: { year: true, trackName: true },
    distinct: ["year", "trackName"],
  });
  const doneKeys = new Set(alreadyImported.map((r) => `${r.year}|${r.trackName}`));

  const pending: { year: number; raceId: number; raceName: string }[] = [];
  for (const year of years) {
    let list;
    try {
      list = await fetchSeasonRaceList(year);
    } catch (cause) {
      return { ok: false, error: `Couldn't fetch the ${year} schedule: ${(cause as Error).message}` };
    }
    for (const entry of list) {
      if (entry.series_id !== CUP_SERIES_ID) continue;
      const key = `${year}|${entry.race_name}`;
      if (doneKeys.has(key)) continue;
      pending.push({ year, raceId: entry.race_id, raceName: entry.race_name });
    }
  }

  if (pending.length === 0) {
    return { ok: true, message: `Nothing left to import — all ${years[0]}-${years[years.length - 1]} Cup races are in.` };
  }

  const batch = pending.slice(0, HISTORICAL_IMPORT_BATCH_SIZE);
  const imported: string[] = [];
  const failed: { race: string; error: string }[] = [];

  for (const item of batch) {
    try {
      const weekend = await fetchWeekendFeed(item.year, CUP_SERIES_ID, item.raceId);
      const parsed = parseWeekendData(weekend);
      if (!parsed || parsed.results.length === 0) {
        failed.push({ race: `${item.year} ${item.raceName}`, error: "No results in the feed for this race." });
        continue;
      }

      await prisma.$transaction(async (tx) => {
        for (const result of parsed.results) {
          const driver = await findOrCreateDriverByName(tx, result.driverName, { isActive: false });
          await tx.historicalRaceResult.upsert({
            where: { year_trackName_driverId: { year: item.year, trackName: item.raceName, driverId: driver.id } },
            update: { finishingPosition: result.position },
            create: {
              year: item.year,
              trackName: item.raceName,
              driverId: driver.id,
              finishingPosition: result.position,
            },
          });
        }
      });
      imported.push(`${item.year} ${item.raceName}`);
    } catch (cause) {
      failed.push({ race: `${item.year} ${item.raceName}`, error: (cause as Error).message });
    }
  }

  const remaining = pending.length - batch.length;
  const failedNote = failed.length > 0 ? ` Failed: ${failed.map((f) => `${f.race} (${f.error})`).join("; ")}.` : "";
  const remainingNote = remaining > 0 ? ` ${remaining} race(s) still remaining — click again to continue.` : " All done.";
  return {
    ok: true,
    message: `Imported ${imported.length} of ${batch.length} race(s) this batch.${remainingNote}${failedNote}`,
  };
}
