import { prisma } from "./prisma";

export type DeleteResult = { ok: true } | { ok: false; error: string };

// Irreversible — every membership, pick, score, and password-reset token
// for this user is gone, along with the account itself.
//
// A league's ownerId is a plain string (no Prisma relation — see
// leagueDelete.ts's comment on the schema), so Prisma can't cascade or
// even warn about it. Deleting the owner out from under a league would
// leave it pointing at a dead user, so that's refused outright: the
// admin has to reassign ownership or delete the league first (both
// already possible from the league's own settings / /admin/leagues).
export async function deleteUser(userId: string): Promise<DeleteResult> {
  try {
    await prisma.$transaction(async (tx) => {
      await tx.user.findUniqueOrThrow({ where: { id: userId } });

      const ownedLeagues = await tx.league.findMany({
        where: { ownerId: userId },
        select: { name: true },
      });
      if (ownedLeagues.length > 0) {
        throw new Error(
          `Still owns ${ownedLeagues.length} league${ownedLeagues.length === 1 ? "" : "s"} (${ownedLeagues
            .map((l) => l.name)
            .join(", ")}) — reassign ownership or delete the league first.`,
        );
      }

      await tx.score.deleteMany({ where: { pick: { userId } } });
      await tx.pick.deleteMany({ where: { userId } });
      await tx.leagueMembership.deleteMany({ where: { userId } });
      await tx.passwordResetToken.deleteMany({ where: { userId } });
      await tx.user.delete({ where: { id: userId } });
    });
    return { ok: true };
  } catch (cause) {
    return { ok: false, error: (cause as Error).message };
  }
}
