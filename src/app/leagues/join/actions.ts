"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function joinLeague(
  _prevState: string | undefined,
  formData: FormData,
): Promise<string | undefined> {
  const inviteCode = formData.get("inviteCode");
  if (typeof inviteCode !== "string" || inviteCode.trim().length === 0) {
    return "Enter an invite code.";
  }

  const session = await auth();
  if (!session?.user?.id) {
    return "You need to be signed in to join a league.";
  }
  const userId = session.user.id;

  const league = await prisma.league.findUnique({
    where: { inviteCode: inviteCode.trim() },
  });
  if (!league) {
    return "That invite code doesn't match any league.";
  }

  await prisma.leagueMembership.upsert({
    where: { leagueId_userId: { leagueId: league.id, userId } },
    update: {},
    create: { leagueId: league.id, userId, role: "MEMBER" },
  });

  // The sidebar's league quick-list is fetched by the root layout, which
  // Next.js otherwise keeps cached across this redirect.
  revalidatePath("/", "layout");
  redirect(`/leagues/${league.id}`);
}
