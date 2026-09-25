import type { Prisma } from "@prisma/client";

// Used everywhere a NASCAR feed (live sync, historical import) needs a
// Driver row for a name it just read off the wire. A plain
// `driver.upsert({ where: { name } })` — what both call sites used to do —
// matches on exact string equality only, so a feed name that differs from
// our stored one by case or incidental whitespace (trailing space, a
// double space) silently creates a SECOND Driver row for the same real
// person instead of finding the existing one. That duplicate then quietly
// starts collecting new results/points while the original row (with its
// car number, bio, headshot) goes stale — exactly what happened to a
// handful of drivers before this existed. Case/whitespace-insensitive
// matching here doesn't fix an already-diverged name (e.g. "John H.
// Nemechek" vs "John Hunter Nemechek" needs a manual merge), but it stops
// the easy, silent cases from recurring.
export async function findOrCreateDriverByName(
  tx: Prisma.TransactionClient,
  rawName: string,
  createExtra: Record<string, unknown> = {},
) {
  const name = rawName.trim();
  const existing = await tx.driver.findFirst({ where: { name: { equals: name, mode: "insensitive" } } });
  if (existing) return existing;
  return tx.driver.create({ data: { name, ...createExtra } });
}
