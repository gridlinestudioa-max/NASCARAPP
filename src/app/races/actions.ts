"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { ownsALeagueInSeason } from "@/lib/authz";
import { syncSeasonScheduleWithNascarFeed } from "@/lib/raceSync";

export async function syncSeasonScheduleFromNascar(seasonId: string): Promise<string> {
  const session = await auth();
  if (!session?.user?.id) {
    return "You need to be signed in.";
  }

  const authorized = await ownsALeagueInSeason(session.user.id, seasonId);
  if (!authorized) {
    return "Only a league owner in this season can sync the schedule.";
  }

  const result = await syncSeasonScheduleWithNascarFeed(seasonId);

  revalidatePath("/races");
  revalidatePath("/stats");

  return result.ok ? result.message : result.error;
}
