"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ownsALeagueInSeason } from "@/lib/authz";
import { syncRaceWithNascarFeed } from "@/lib/raceSync";

export async function syncRaceFromNascar(raceId: string): Promise<string> {
  const session = await auth();
  if (!session?.user?.id) {
    return "You need to be signed in.";
  }

  const race = await prisma.race.findUnique({ where: { id: raceId } });
  if (!race) {
    return "Race not found.";
  }

  const authorized = await ownsALeagueInSeason(session.user.id, race.seasonId);
  if (!authorized) {
    return "Only a league owner in this season can sync race data.";
  }

  const result = await syncRaceWithNascarFeed(raceId);

  revalidatePath(`/races/${raceId}`);
  revalidatePath(`/races/${raceId}/results`);
  revalidatePath(`/races/${raceId}/qualifying`);
  revalidatePath(`/races/${raceId}/tiers`);
  revalidatePath(`/stats`);

  return result.ok ? result.message : result.error;
}
