// Site-wide Tiered Lineup tier bucket sizes — split out from tierRanking.ts
// (which pulls in prisma/DB access) so client-safe code, like the rules
// editor's capacity check, can use these without bundling server-only
// dependencies. The same for every Tiered Lineup league, since
// DriverTierAssignment itself is shared across leagues.
export const TIER_A_SIZE = 8;
export const TIER_B_SIZE = 20;
