import { prisma } from "./prisma";

// findOrCreateDriverByName (driverMatch.ts) only self-heals a feed name that
// differs from ours by case or incidental whitespace. Anything else — a
// missing middle initial ("John H. Nemechek" vs "John Hunter Nemechek"), a
// punctuation difference ("A.J. Allmendinger" vs "AJ Allmendinger"), or a
// plain typo — silently creates a second Driver row that starts collecting
// its own results/points while the original goes stale. This module finds
// those pairs and merges one into the other.

export type Driver = { id: string; name: string; number: number | null };

// Strips everything but letters/digits — collapses "A.J.", "AJ", "A J" (and
// "Jr."/"Sr." suffixes with or without the period) all down to the same key,
// which case/whitespace-insensitive equality alone doesn't catch.
export function normalizeForMatch(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

// Classic edit-distance — small enough to hand-roll rather than pull in a
// dependency for one function. Used only as a last-resort typo catch (see
// TYPO_MAX_DISTANCE below), after the higher-precision checks below it.
function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  let prev = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) {
      cur[j] = a[i - 1] === b[j - 1] ? prev[j - 1] : 1 + Math.min(prev[j - 1], prev[j], cur[j - 1]);
    }
    prev = cur;
  }
  return prev[n];
}

function splitName(name: string): { first: string; last: string } {
  const parts = name.trim().split(/\s+/);
  return { first: parts[0] ?? "", last: parts[parts.length - 1] ?? "" };
}

// A short name only needs to be a couple characters off to plausibly be a
// typo of another; a long one needs proportionally more slack. Kept small
// (2) so this stays a "did someone fat-finger this" check, not a general
// fuzzy-name-matcher that would start pairing up unrelated drivers.
const TYPO_MAX_DISTANCE = 2;

export type DuplicateCandidate = { a: Driver; b: Driver; reason: string };

// Pairwise (O(n^2)) — fine for a few hundred drivers, and this only runs
// when an admin opens the page, not on any hot path.
export function findLikelyDuplicateDriverPairs(drivers: Driver[]): DuplicateCandidate[] {
  const out: DuplicateCandidate[] = [];
  for (let i = 0; i < drivers.length; i++) {
    for (let j = i + 1; j < drivers.length; j++) {
      const a = drivers[i];
      const b = drivers[j];
      const reason = duplicateReason(a.name, b.name);
      if (reason) out.push({ a, b, reason });
    }
  }
  return out;
}

function duplicateReason(nameA: string, nameB: string): string | null {
  const normA = normalizeForMatch(nameA);
  const normB = normalizeForMatch(nameB);
  if (normA === normB) return "Same name once punctuation/spacing is ignored";

  const splitA = splitName(nameA);
  const splitB = splitName(nameB);
  const lastA = normalizeForMatch(splitA.last);
  const lastB = normalizeForMatch(splitB.last);
  if (lastA && lastA === lastB) {
    const firstA = normalizeForMatch(splitA.first);
    const firstB = normalizeForMatch(splitB.first);
    // One first name is a prefix of the other ("john" / "j", "hunter" /
    // "h") — catches an initial standing in for a full middle/first name.
    if (firstA && firstB && (firstA.startsWith(firstB) || firstB.startsWith(firstA))) {
      return "Same last name, one first name looks like a short form of the other";
    }
  }

  if (normA.length >= 5 && normB.length >= 5 && levenshtein(normA, normB) <= TYPO_MAX_DISTANCE) {
    return "Names are only a couple characters apart — possible typo";
  }

  return null;
}

export type MergeResult = { ok: true } | { ok: false; error: string };

// Folds mergeId's data into keepId and deletes mergeId. Irreversible, so
// the caller (the admin merge action) is expected to confirm with the
// admin first — this function itself does no confirmation of its own.
//
// Every driver-referencing table except Pick has a unique key that pairs
// driverId with something else (raceId, season, etc.) — reassigning
// mergeId's row to keepId can collide with a row keepId already has for
// that same key (e.g. both drivers already have a RaceResult for the same
// race, because the sync created a duplicate mid-race). Each block below
// drops mergeId's row in that case (keepId's is the authoritative one) and
// reassigns it otherwise. Pick's uniqueness is per league/user/race/slot,
// independent of which driver fills the slot, so it can't collide and is
// reassigned unconditionally.
export async function mergeDrivers(keepId: string, mergeId: string): Promise<MergeResult> {
  if (keepId === mergeId) return { ok: false, error: "Can't merge a driver into itself." };

  try {
    await prisma.$transaction(async (tx) => {
      const [keep, merge] = await Promise.all([
        tx.driver.findUniqueOrThrow({ where: { id: keepId } }),
        tx.driver.findUniqueOrThrow({ where: { id: mergeId } }),
      ]);

      for (const row of await tx.raceResult.findMany({ where: { driverId: mergeId } })) {
        const existing = await tx.raceResult.findFirst({ where: { driverId: keepId, raceId: row.raceId } });
        if (existing) await tx.raceResult.delete({ where: { id: row.id } });
        else await tx.raceResult.update({ where: { id: row.id }, data: { driverId: keepId } });
      }

      for (const row of await tx.raceEntry.findMany({ where: { driverId: mergeId } })) {
        const existing = await tx.raceEntry.findFirst({ where: { driverId: keepId, raceId: row.raceId } });
        if (existing) await tx.raceEntry.delete({ where: { id: row.id } });
        else await tx.raceEntry.update({ where: { id: row.id }, data: { driverId: keepId } });
      }

      for (const row of await tx.qualifyingResult.findMany({ where: { driverId: mergeId } })) {
        const existing = await tx.qualifyingResult.findFirst({ where: { driverId: keepId, raceId: row.raceId } });
        if (existing) await tx.qualifyingResult.delete({ where: { id: row.id } });
        else await tx.qualifyingResult.update({ where: { id: row.id }, data: { driverId: keepId } });
      }

      for (const row of await tx.driverTierAssignment.findMany({ where: { driverId: mergeId } })) {
        const existing = await tx.driverTierAssignment.findFirst({ where: { driverId: keepId, raceId: row.raceId } });
        if (existing) await tx.driverTierAssignment.delete({ where: { id: row.id } });
        else await tx.driverTierAssignment.update({ where: { id: row.id }, data: { driverId: keepId } });
      }

      for (const row of await tx.stageResult.findMany({ where: { driverId: mergeId } })) {
        const existing = await tx.stageResult.findFirst({
          where: { driverId: keepId, raceId: row.raceId, stageNumber: row.stageNumber },
        });
        if (existing) await tx.stageResult.delete({ where: { id: row.id } });
        else await tx.stageResult.update({ where: { id: row.id }, data: { driverId: keepId } });
      }

      for (const row of await tx.seasonDriver.findMany({ where: { driverId: mergeId } })) {
        const existing = await tx.seasonDriver.findFirst({ where: { driverId: keepId, seasonId: row.seasonId } });
        if (existing) await tx.seasonDriver.delete({ where: { id: row.id } });
        else await tx.seasonDriver.update({ where: { id: row.id }, data: { driverId: keepId } });
      }

      for (const row of await tx.historicalRaceResult.findMany({ where: { driverId: mergeId } })) {
        const existing = await tx.historicalRaceResult.findFirst({
          where: { driverId: keepId, year: row.year, trackName: row.trackName },
        });
        if (existing) await tx.historicalRaceResult.delete({ where: { id: row.id } });
        else await tx.historicalRaceResult.update({ where: { id: row.id }, data: { driverId: keepId } });
      }

      await tx.pick.updateMany({ where: { driverId: mergeId }, data: { driverId: keepId } });

      // Fill in whichever profile fields the kept driver is missing from
      // the one being merged away, rather than losing them — the two rows
      // may have been enriched independently (e.g. one via historical
      // import, the other via a manual admin edit).
      await tx.driver.update({
        where: { id: keepId },
        data: {
          number: keep.number ?? merge.number,
          team: keep.team ?? merge.team,
          bio: keep.bio ?? merge.bio,
        },
      });

      await tx.driver.delete({ where: { id: mergeId } });
    });
    return { ok: true };
  } catch (cause) {
    return { ok: false, error: (cause as Error).message };
  }
}
