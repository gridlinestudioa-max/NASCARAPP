"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isSiteAdmin } from "@/lib/authz";

export async function updateRaceSchedule(
  _prevState: string | undefined,
  formData: FormData,
): Promise<string | undefined> {
  const raceId = formData.get("raceId");
  const trackName = formData.get("trackName");
  const dateRaw = formData.get("date");

  if (typeof raceId !== "string" || typeof trackName !== "string" || typeof dateRaw !== "string") {
    return "Missing race, track name, or date.";
  }

  const session = await auth();
  if (!session?.user?.id || !isSiteAdmin(session.user.email)) {
    return "Not authorized.";
  }

  const trimmedTrackName = trackName.trim();
  if (!trimmedTrackName) {
    return "Track name can't be blank.";
  }
  const date = new Date(dateRaw);
  if (Number.isNaN(date.getTime())) {
    return "Enter a valid date.";
  }

  await prisma.race.update({ where: { id: raceId }, data: { trackName: trimmedTrackName, date } });

  revalidatePath(`/admin/races/${raceId}`);
  revalidatePath("/admin");
  revalidatePath("/races");
  revalidatePath(`/races/${raceId}`);
  return "Schedule updated.";
}
