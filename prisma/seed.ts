import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is not set");
}
const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

const SEED_DATA_DIR = path.join(__dirname, "seed-data");

type DriverRecord = { fullName: string };

type SeedRecord = {
  week: number;
  track: string;
  player: string;
  pick_raw: string;
  driver_full_name: string | null;
  finish_position: number | null;
  base_points: number | null;
  win_bonus: number | null;
  total_points: number;
  stage_bonus_recorded: number;
  running_total: number;
  non_points_event: boolean;
  needs_review: boolean;
  review_reason?: string;
  flag?: string;
  note?: string;
};

const PLAYERS = ["Will", "Bo", "Doug", "Zp", "Barth Jr", "Barth Sr"] as const;

// Deterministic placeholder accounts for the six league players — this data
// predates the app having real signup/auth, so there's no real email to use.
const PLAYER_EMAILS: Record<(typeof PLAYERS)[number], string> = {
  Will: "will@fantasynascarhq.local",
  Bo: "bo@fantasynascarhq.local",
  Doug: "doug@fantasynascarhq.local",
  Zp: "zp@fantasynascarhq.local",
  "Barth Jr": "barth-jr@fantasynascarhq.local",
  "Barth Sr": "barth-sr@fantasynascarhq.local",
};

const SEASON_YEAR = 2025;
const LEAGUE_NAME = "Fantasy NASCAR HQ";
const RULESET_LABEL = `${SEASON_YEAR} Season Rules`;

function loadJson<T>(filename: string): T {
  return JSON.parse(fs.readFileSync(path.join(SEED_DATA_DIR, filename), "utf-8"));
}

// The one record in nascar_seed.json without a resolved driver_full_name
// (Dover/Bo, week 13) falls back to matching pick_raw's surname against the
// master driver list. Throws instead of guessing if that's ever ambiguous.
function matchDriverBySurname(pickRaw: string, driverNames: string[]): string {
  const needle = pickRaw.trim().toLowerCase();
  const matches = driverNames.filter((name) => {
    const surname = name.toLowerCase().split(/\s+/).pop()!;
    return surname === needle;
  });
  if (matches.length !== 1) {
    throw new Error(
      `Could not uniquely resolve fallback driver for pick_raw="${pickRaw}" ` +
        `(${matches.length} candidates: ${matches.join(", ") || "none"})`,
    );
  }
  return matches[0];
}

// Infer a race's field size from "base = fieldSize + 1 - finishPosition"
// using the most common implied value across that week's resolved picks —
// a few individual records are flagged as likely typos, and mode is robust
// to those without needing to "fix" anything.
function inferFieldSize(weekRecords: SeedRecord[]): number {
  const implied = weekRecords
    .filter((r) => r.base_points != null && r.finish_position != null)
    .map((r) => r.base_points! + r.finish_position! - 1);

  // A negative implied field size is impossible, not just uncertain — it
  // only shows up on the weeks already flagged needs_review, where the
  // formula itself doesn't reconcile. Drop those before taking the median,
  // so this derived Race metadata (not part of the recorded Score data
  // itself, which is stored exactly as given) never ends up nonsensical.
  const plausible = implied.filter((v) => v > 0);
  const pool = plausible.length > 0 ? plausible : implied;
  if (pool.length === 0) {
    throw new Error(`Could not infer field size for week ${weekRecords[0]?.week} — no resolved records`);
  }
  const sorted = [...pool].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const median = sorted.length % 2 === 0 ? Math.round((sorted[mid - 1] + sorted[mid]) / 2) : sorted[mid];
  return median;
}

async function main() {
  const drivers = loadJson<DriverRecord[]>("nascar_drivers.json");
  const seedRecords = loadJson<SeedRecord[]>("nascar_seed.json");
  const driverNames = drivers.map((d) => d.fullName);

  console.log(`Loaded ${drivers.length} drivers, ${seedRecords.length} seed records.`);

  // ---------- Users ----------
  const userByPlayer = new Map<string, { id: string }>();
  for (const player of PLAYERS) {
    const email = PLAYER_EMAILS[player];
    const user = await prisma.user.upsert({
      where: { email },
      update: { name: player },
      create: { email, name: player },
    });
    userByPlayer.set(player, user);
  }
  console.log(`Upserted ${userByPlayer.size} users.`);

  // ---------- League ----------
  let league = await prisma.league.findFirst({ where: { name: LEAGUE_NAME } });
  if (!league) {
    league = await prisma.league.create({
      data: {
        name: LEAGUE_NAME,
        type: "PICKEM",
        ownerId: userByPlayer.get("Will")!.id,
      },
    });
  }

  // ---------- RuleSet ----------
  let ruleSet = await prisma.ruleSet.findFirst({
    where: { leagueId: league.id, label: RULESET_LABEL },
  });
  const ruleSetConfig = {
    picksPerWeek: 1,
    eligibility: "any_driver",
    scoring: {
      base: "fieldSize + 1 - finishPosition",
      winBonus: 10,
      stageBonusPerStageWin: 5,
      maxStageBonus: 10,
    },
  };
  if (!ruleSet) {
    ruleSet = await prisma.ruleSet.create({
      data: { leagueId: league.id, label: RULESET_LABEL, config: ruleSetConfig },
    });
  }

  // ---------- Season ----------
  const season = await prisma.season.upsert({
    where: { leagueId_year: { leagueId: league.id, year: SEASON_YEAR } },
    update: { ruleSetId: ruleSet.id },
    create: { leagueId: league.id, year: SEASON_YEAR, ruleSetId: ruleSet.id },
  });

  // ---------- Drivers ----------
  const driverIdByName = new Map<string, string>();
  for (const d of drivers) {
    const driver = await prisma.driver.upsert({
      where: { name: d.fullName },
      update: {},
      create: { name: d.fullName },
    });
    driverIdByName.set(d.fullName, driver.id);
  }
  console.log(`Upserted ${driverIdByName.size} drivers.`);

  function resolveDriverId(record: SeedRecord): string {
    const name = record.driver_full_name ?? matchDriverBySurname(record.pick_raw, driverNames);
    const id = driverIdByName.get(name);
    if (!id) {
      throw new Error(`Driver "${name}" not found (week ${record.week}, player ${record.player})`);
    }
    return id;
  }

  // ---------- Races (one per week) ----------
  const weeks = [...new Set(seedRecords.map((r) => r.week))].sort((a, b) => a - b);
  const raceByWeek = new Map<number, { id: string }>();
  // Track dates aren't in the source data; space races a week apart from an
  // arbitrary season-open anchor purely so `date` (NOT NULL) has a value —
  // `week` is the actual authoritative ordinal, not `date`.
  const seasonAnchor = Date.UTC(SEASON_YEAR, 1, 9); // early Feb
  for (const week of weeks) {
    const weekRecords = seedRecords.filter((r) => r.week === week);
    const track = weekRecords[0].track;
    const isNonPoints = weekRecords[0].non_points_event;
    const fieldSize = inferFieldSize(weekRecords);
    const date = new Date(seasonAnchor + (week - 1) * 7 * 24 * 60 * 60 * 1000);

    const race = await prisma.race.upsert({
      where: { seasonId_week: { seasonId: season.id, week } },
      update: { trackName: track, isNonPoints, fieldSize, status: "COMPLETE", date },
      create: {
        seasonId: season.id,
        week,
        trackName: track,
        date,
        fieldSize,
        status: "COMPLETE",
        isNonPoints,
      },
    });
    raceByWeek.set(week, race);
  }
  console.log(`Upserted ${raceByWeek.size} races.`);

  // ---------- Picks + Scores ----------
  let pickCount = 0;
  let scoreCount = 0;
  for (const record of seedRecords) {
    const race = raceByWeek.get(record.week)!;
    const user = userByPlayer.get(record.player);
    if (!user) {
      throw new Error(`Unknown player "${record.player}" at week ${record.week}`);
    }
    const driverId = resolveDriverId(record);

    // Manual find-then-update-or-create on (league, user, race) rather than
    // Prisma's upsert: the schema's unique constraint also includes
    // driverId (to allow multiple picks per race in Tiered Draft leagues),
    // so a plain upsert keyed on that combo wouldn't be idempotent if a
    // driver resolution ever changed on rerun.
    let pick = await prisma.pick.findFirst({
      where: { leagueId: league.id, userId: user.id, raceId: race.id },
    });
    if (pick) {
      pick = await prisma.pick.update({
        where: { id: pick.id },
        data: { driverId, tierId: null },
      });
    } else {
      pick = await prisma.pick.create({
        data: { leagueId: league.id, userId: user.id, raceId: race.id, driverId, tierId: null },
      });
    }
    pickCount++;

    await prisma.score.upsert({
      where: { pickId: pick.id },
      update: {
        finishPosition: record.finish_position,
        baseScore: record.base_points,
        winBonus: record.win_bonus,
        stageBonus: record.stage_bonus_recorded,
        total: record.total_points,
        needsReview: record.needs_review,
      },
      create: {
        pickId: pick.id,
        finishPosition: record.finish_position,
        baseScore: record.base_points,
        winBonus: record.win_bonus,
        stageBonus: record.stage_bonus_recorded,
        total: record.total_points,
        needsReview: record.needs_review,
      },
    });
    scoreCount++;
  }
  console.log(`Upserted ${pickCount} picks and ${scoreCount} scores.`);

  // ---------- Reconciliation ----------
  console.log("\nReconciling summed Score.total per player against their week-29 running_total...");
  const finalWeek = Math.max(...weeks);
  const mismatches: string[] = [];
  for (const player of PLAYERS) {
    const user = userByPlayer.get(player)!;
    const picks = await prisma.pick.findMany({
      where: { leagueId: league.id, userId: user.id },
      include: { score: true },
    });
    const sum = picks.reduce((acc, p) => acc + (p.score?.total ?? 0), 0);
    const finalRecord = seedRecords.find((r) => r.player === player && r.week === finalWeek);
    const expected = finalRecord?.running_total ?? null;
    const match = expected != null && sum === expected;
    console.log(
      `  ${player}: summed=${sum}, expected(week ${finalWeek})=${expected} -> ${match ? "MATCH" : "MISMATCH"}`,
    );
    if (!match) mismatches.push(player);
  }

  // ---------- Summary ----------
  const needsReviewWeeks = [...new Set(seedRecords.filter((r) => r.needs_review).map((r) => r.week))].sort(
    (a, b) => a - b,
  );
  console.log("\n=== Seed summary ===");
  console.log(`Users: ${userByPlayer.size}`);
  console.log(`Drivers: ${driverIdByName.size}`);
  console.log(`Races: ${raceByWeek.size}`);
  console.log(`Picks: ${pickCount}`);
  console.log(`Scores: ${scoreCount}`);
  console.log(`Weeks flagged needsReview: ${needsReviewWeeks.join(", ")}`);

  if (mismatches.length > 0) {
    console.log(`\n⚠️  RECONCILIATION FAILED for: ${mismatches.join(", ")}`);
    process.exitCode = 1;
  } else {
    console.log("\n✅ Reconciliation passed for all players.");
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
