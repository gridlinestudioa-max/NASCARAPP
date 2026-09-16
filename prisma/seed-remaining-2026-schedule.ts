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

// The 29 races from prisma/seed.ts (Daytona 1 .. Gateway, weeks 1-29) are
// this same season, already played — they line up with the real 2026 Cup
// schedule through the Sep 13 WWT race. This adds only what comes after:
// the remaining real 2026 races from Bristol's night race through the
// championship, continuing that same week numbering. fieldSize is a
// placeholder (36 = standard current-era Cup field) — correct it once real
// results are known, same as the needs_review weeks in the historical data.
const REMAINING_SCHEDULE: Array<{
  week: number;
  date: string;
  name: string;
  isNonPoints: boolean;
  fieldSize: number;
}> = [
  { week: 30, date: "2026-09-19", name: "Bass Pro Shops Night Race", isNonPoints: false, fieldSize: 36 },
  { week: 31, date: "2026-09-27", name: "Hollywood Casino 400", isNonPoints: false, fieldSize: 36 },
  { week: 32, date: "2026-10-04", name: "South Point 400", isNonPoints: false, fieldSize: 36 },
  { week: 33, date: "2026-10-11", name: "Bank of America 400", isNonPoints: false, fieldSize: 36 },
  { week: 34, date: "2026-10-18", name: "Freeway Insurance 500", isNonPoints: false, fieldSize: 36 },
  { week: 35, date: "2026-10-25", name: "YellaWood 500", isNonPoints: false, fieldSize: 36 },
  { week: 36, date: "2026-11-01", name: "Xfinity 500", isNonPoints: false, fieldSize: 36 },
  { week: 37, date: "2026-11-08", name: "NASCAR Cup Series Championship Race", isNonPoints: false, fieldSize: 36 },
];

async function main() {
  const league = await prisma.league.findFirst({ where: { name: LEAGUE_NAME } });
  if (!league) {
    throw new Error(`League "${LEAGUE_NAME}" not found — run the main seed script first.`);
  }

  const season = await prisma.season.findUnique({
    where: { leagueId_year: { leagueId: league.id, year: SEASON_YEAR } },
  });
  if (!season) {
    throw new Error(`Season ${SEASON_YEAR} not found — run the main seed script first.`);
  }

  for (const race of REMAINING_SCHEDULE) {
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

  console.log(`Upserted ${REMAINING_SCHEDULE.length} remaining races into the ${SEASON_YEAR} season (${season.id}).`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
