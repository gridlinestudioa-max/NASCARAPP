// Standalone placeholder-data seed for a Tiered Lineup test league — run
// manually (`npx tsx prisma/seed-tiered-placeholder.ts`), never as part of
// the main seed. Creates its own dedicated test users/league so it never
// touches the real "Fantasy NASCAR HQ" Pick'em league or its data. Purpose:
// give the Tiered Lineup UI (weekly roster form, tiers, scoring) real rows
// to exercise end-to-end without waiting on a real Tiered Lineup league to
// exist.
import "dotenv/config";
import { PrismaClient, type DriverTier } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { generateInviteCode } from "../src/lib/inviteCode";
import { buildTieredDraftDefaultConfig, TIERED_LINEUP_SLOTS } from "../src/lib/tieredDraft";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is not set");
}
const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

const LEAGUE_NAME = "Tiered Lineup Test League";
const TIER_A_SIZE = 8;
const TIER_B_SIZE = 20;

const TEST_PLAYERS = [
  { name: "Test Player 1", email: "tiered-test-1@fantasynascarhq.local" },
  { name: "Test Player 2", email: "tiered-test-2@fantasynascarhq.local" },
  { name: "Test Player 3", email: "tiered-test-3@fantasynascarhq.local" },
  { name: "Test Player 4", email: "tiered-test-4@fantasynascarhq.local" },
] as const;

async function main() {
  // ---------- Season + a race to build a test lineup around ----------
  const season = await prisma.season.findFirst({ orderBy: { year: "desc" } });
  if (!season) throw new Error("No Season exists yet — run the main seed first.");

  const now = new Date();
  const race =
    (await prisma.race.findFirst({ where: { seasonId: season.id, date: { gte: now } }, orderBy: { date: "asc" } })) ??
    (await prisma.race.findFirst({ where: { seasonId: season.id }, orderBy: { date: "desc" } }));
  if (!race) throw new Error("No Race exists yet for the current season — run the main seed first.");
  console.log(`Using race: Week ${race.week} — ${race.trackName} (${race.date.toISOString().slice(0, 10)})`);

  // ---------- Users + League ----------
  const users = [];
  for (const p of TEST_PLAYERS) {
    users.push(await prisma.user.upsert({ where: { email: p.email }, update: { name: p.name }, create: p }));
  }

  let league = await prisma.league.findFirst({ where: { name: LEAGUE_NAME } });
  if (!league) {
    league = await prisma.league.create({
      data: { name: LEAGUE_NAME, type: "TIERED_DRAFT", ownerId: users[0].id, inviteCode: generateInviteCode() },
    });
  }
  console.log(`League: ${league.name} (${league.id})`);

  for (const user of users) {
    await prisma.leagueMembership.upsert({
      where: { leagueId_userId: { leagueId: league.id, userId: user.id } },
      update: {},
      create: { leagueId: league.id, userId: user.id, role: user.id === league.ownerId ? "OWNER" : "MEMBER" },
    });
  }
  console.log(`Upserted ${users.length} memberships.`);

  // ---------- RuleSet + LeagueSeason ----------
  const ruleSet = await prisma.ruleSet.create({
    data: { leagueId: league.id, label: `${season.year} Season Rules`, config: buildTieredDraftDefaultConfig() },
  });
  await prisma.leagueSeason.upsert({
    where: { leagueId_seasonId: { leagueId: league.id, seasonId: season.id } },
    update: { ruleSetId: ruleSet.id },
    create: { leagueId: league.id, seasonId: season.id, ruleSetId: ruleSet.id },
  });

  // ---------- Driver tiers for this race ----------
  const drivers = await prisma.driver.findMany({ orderBy: { name: "asc" } });
  if (drivers.length < TIER_A_SIZE + TIER_B_SIZE + 1) {
    throw new Error(`Only ${drivers.length} drivers exist — need at least ${TIER_A_SIZE + TIER_B_SIZE + 1}.`);
  }
  const tierOf = (index: number): DriverTier =>
    index < TIER_A_SIZE ? "A" : index < TIER_A_SIZE + TIER_B_SIZE ? "B" : "C";

  await prisma.$transaction(
    drivers.map((d, i) =>
      prisma.driverTierAssignment.upsert({
        where: { raceId_driverId: { raceId: race.id, driverId: d.id } },
        update: { tier: tierOf(i), source: "MANUAL" },
        create: { raceId: race.id, driverId: d.id, tier: tierOf(i), source: "MANUAL" },
      }),
    ),
  );
  const driversByTier: Record<DriverTier, { id: string; name: string }[]> = { A: [], B: [], C: [] };
  drivers.forEach((d, i) => driversByTier[tierOf(i)].push(d));
  console.log(`Assigned tiers: A=${driversByTier.A.length}, B=${driversByTier.B.length}, C=${driversByTier.C.length}`);

  // ---------- Placeholder lineups (one per test player, offset so nobody's identical) ----------
  let pickCount = 0;
  for (let userIndex = 0; userIndex < users.length; userIndex++) {
    const user = users[userIndex];
    for (const slot of TIERED_LINEUP_SLOTS) {
      const pool = driversByTier[slot.tier];
      // Offsetting by role (STARTER vs BENCH) and userIndex keeps each
      // slot's driver distinct within a lineup and varies lineups player
      // to player, without needing real randomness for placeholder data.
      const roleOffset = slot.role === "BENCH" ? 1 : 0;
      const tierSlotIndex = TIERED_LINEUP_SLOTS.filter((s) => s.tier === slot.tier).indexOf(slot);
      const driver = pool[(userIndex * 3 + tierSlotIndex + roleOffset) % pool.length];

      await prisma.pick.upsert({
        where: {
          leagueId_userId_raceId_pickNumber: {
            leagueId: league.id,
            userId: user.id,
            raceId: race.id,
            pickNumber: slot.pickNumber,
          },
        },
        update: { driverId: driver.id },
        create: {
          leagueId: league.id,
          userId: user.id,
          raceId: race.id,
          pickNumber: slot.pickNumber,
          driverId: driver.id,
        },
      });
      pickCount++;
    }
  }
  console.log(`Upserted ${pickCount} picks (${TIERED_LINEUP_SLOTS.length} per player).`);

  console.log("\n✅ Tiered Lineup placeholder data ready.");
  console.log(`   Invite code: ${league.inviteCode}`);
  console.log(`   Sign in as any of: ${TEST_PLAYERS.map((p) => p.email).join(", ")} (no password set — use the admin/dev flow to set one if needed).`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
