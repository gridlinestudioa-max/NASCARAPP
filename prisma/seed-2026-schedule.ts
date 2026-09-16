import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is not set");
}
const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

const LEAGUE_NAME = "Fantasy NASCAR HQ";
const SEASON_YEAR = 2026;
const RULESET_LABEL = `${SEASON_YEAR} Season Rules`;

// Same formula as the 2025 RuleSet — carried forward as a new, independently
// versioned row rather than reusing 2025's (RuleSets are never edited in
// place once a season references them).
const RULESET_CONFIG = {
  picksPerWeek: 1,
  eligibility: "any_driver",
  scoring: {
    base: "fieldSize + 1 - finishPosition",
    winBonus: 10,
    stageBonusPerStageWin: 5,
    maxStageBonus: 10,
  },
};

// fieldSize is a placeholder (36 for a standard Cup points race under the
// current charter agreement; smaller/larger for exhibition events) — it
// only matters once real results come in and scoring is computed, at which
// point it should be corrected from the actual entry list.
const SCHEDULE: Array<{
  week: number;
  date: string;
  name: string;
  isNonPoints: boolean;
  fieldSize: number;
}> = [
  { week: 1, date: "2026-02-04", name: "Cook Out Clash", isNonPoints: true, fieldSize: 24 },
  { week: 2, date: "2026-02-12", name: "America 250 Florida Duel 1", isNonPoints: true, fieldSize: 20 },
  { week: 3, date: "2026-02-12", name: "America 250 Florida Duel 2", isNonPoints: true, fieldSize: 20 },
  { week: 4, date: "2026-02-15", name: "Daytona 500", isNonPoints: false, fieldSize: 40 },
  { week: 5, date: "2026-02-22", name: "Autotrader 400", isNonPoints: false, fieldSize: 36 },
  { week: 6, date: "2026-03-01", name: "DuraMAX Grand Prix", isNonPoints: false, fieldSize: 36 },
  { week: 7, date: "2026-03-08", name: "Straight Talk Wireless 500", isNonPoints: false, fieldSize: 36 },
  { week: 8, date: "2026-03-15", name: "Pennzoil 400", isNonPoints: false, fieldSize: 36 },
  { week: 9, date: "2026-03-22", name: "Goodyear 400", isNonPoints: false, fieldSize: 36 },
  { week: 10, date: "2026-03-29", name: "Cook Out 400", isNonPoints: false, fieldSize: 36 },
  { week: 11, date: "2026-04-12", name: "Food City 500", isNonPoints: false, fieldSize: 36 },
  { week: 12, date: "2026-04-19", name: "AdventHealth 400", isNonPoints: false, fieldSize: 36 },
  { week: 13, date: "2026-04-26", name: "Jack Link's 500", isNonPoints: false, fieldSize: 36 },
  { week: 14, date: "2026-05-03", name: "WÜRTH 400", isNonPoints: false, fieldSize: 36 },
  { week: 15, date: "2026-05-10", name: "Go Bowling at The Glen", isNonPoints: false, fieldSize: 36 },
  { week: 16, date: "2026-05-17", name: "NASCAR All-Star Race", isNonPoints: true, fieldSize: 23 },
  { week: 17, date: "2026-05-24", name: "Coca-Cola 600", isNonPoints: false, fieldSize: 36 },
  { week: 18, date: "2026-05-31", name: "Cracker Barrel 400", isNonPoints: false, fieldSize: 36 },
  { week: 19, date: "2026-06-07", name: "FireKeepers Casino 400", isNonPoints: false, fieldSize: 36 },
  { week: 20, date: "2026-06-14", name: "Great American Getaway 400", isNonPoints: false, fieldSize: 36 },
  { week: 21, date: "2026-06-21", name: "Anduril 250", isNonPoints: false, fieldSize: 36 },
  { week: 22, date: "2026-06-28", name: "Toyota/Save Mart 350", isNonPoints: false, fieldSize: 36 },
  { week: 23, date: "2026-07-05", name: "NASCAR Cup Series Race at Chicagoland", isNonPoints: false, fieldSize: 36 },
  { week: 24, date: "2026-07-12", name: "Quaker State 400", isNonPoints: false, fieldSize: 36 },
  { week: 25, date: "2026-07-19", name: "Window World 450", isNonPoints: false, fieldSize: 36 },
  { week: 26, date: "2026-07-26", name: "Brickyard 400", isNonPoints: false, fieldSize: 36 },
  { week: 27, date: "2026-08-09", name: "Iowa Corn 350", isNonPoints: false, fieldSize: 36 },
  { week: 28, date: "2026-08-15", name: "Cook Out 400", isNonPoints: false, fieldSize: 36 },
  { week: 29, date: "2026-08-23", name: "NASCAR Cup Series Race at New Hampshire", isNonPoints: false, fieldSize: 36 },
  { week: 30, date: "2026-08-29", name: "Coke Zero Sugar 400", isNonPoints: false, fieldSize: 36 },
  { week: 31, date: "2026-09-06", name: "Cook Out Southern 500", isNonPoints: false, fieldSize: 36 },
  { week: 32, date: "2026-09-13", name: "Enjoy Illinois 300", isNonPoints: false, fieldSize: 36 },
  { week: 33, date: "2026-09-19", name: "Bass Pro Shops Night Race", isNonPoints: false, fieldSize: 36 },
  { week: 34, date: "2026-09-27", name: "Hollywood Casino 400", isNonPoints: false, fieldSize: 36 },
  { week: 35, date: "2026-10-04", name: "South Point 400", isNonPoints: false, fieldSize: 36 },
  { week: 36, date: "2026-10-11", name: "Bank of America 400", isNonPoints: false, fieldSize: 36 },
  { week: 37, date: "2026-10-18", name: "Freeway Insurance 500", isNonPoints: false, fieldSize: 36 },
  { week: 38, date: "2026-10-25", name: "YellaWood 500", isNonPoints: false, fieldSize: 36 },
  { week: 39, date: "2026-11-01", name: "Xfinity 500", isNonPoints: false, fieldSize: 36 },
  { week: 40, date: "2026-11-08", name: "NASCAR Cup Series Championship Race", isNonPoints: false, fieldSize: 36 },
];

async function main() {
  const league = await prisma.league.findFirst({ where: { name: LEAGUE_NAME } });
  if (!league) {
    throw new Error(`League "${LEAGUE_NAME}" not found — run the main seed script first.`);
  }

  let ruleSet = await prisma.ruleSet.findFirst({
    where: { leagueId: league.id, label: RULESET_LABEL },
  });
  if (!ruleSet) {
    ruleSet = await prisma.ruleSet.create({
      data: { leagueId: league.id, label: RULESET_LABEL, config: RULESET_CONFIG },
    });
  }

  const season = await prisma.season.upsert({
    where: { leagueId_year: { leagueId: league.id, year: SEASON_YEAR } },
    update: { ruleSetId: ruleSet.id },
    create: { leagueId: league.id, year: SEASON_YEAR, ruleSetId: ruleSet.id },
  });

  for (const race of SCHEDULE) {
    await prisma.race.upsert({
      where: { seasonId_week: { seasonId: season.id, week: race.week } },
      update: {
        trackName: race.name,
        date: new Date(race.date),
        fieldSize: race.fieldSize,
        isNonPoints: race.isNonPoints,
      },
      create: {
        seasonId: season.id,
        week: race.week,
        trackName: race.name,
        date: new Date(race.date),
        fieldSize: race.fieldSize,
        isNonPoints: race.isNonPoints,
      },
    });
  }

  console.log(`Upserted ${SEASON_YEAR} season (${season.id}) with ${SCHEDULE.length} races.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
