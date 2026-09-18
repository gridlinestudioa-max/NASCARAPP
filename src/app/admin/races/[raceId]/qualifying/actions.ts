"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isSiteAdmin } from "@/lib/authz";
import { applyQualifyingResults } from "@/lib/raceSync";

export async function submitQualifying(
  _prevState: string | undefined,
  formData: FormData,
): Promise<string | undefined> {
  const raceId = formData.get("raceId");
  if (typeof raceId !== "string") {
    return "Missing race.";
  }

  const session = await auth();
  if (!session?.user?.id || !isSiteAdmin(session.user.email)) {
    return "Not authorized.";
  }

  const race = await prisma.race.findUnique({ where: { id: raceId } });
  if (!race) {
    return "Race not found.";
  }

  const tierAssignments = await prisma.driverTierAssignment.findMany({ where: { raceId } });

  const positions = new Map<string, number>();
  for (const { driverId } of tierAssignments) {
    const raw = formData.get(`position-${driverId}`);
    if (typeof raw !== "string" || raw.trim() === "") continue;
    const position = parseInt(raw, 10);
    if (!Number.isInteger(position) || position < 1) {
      return "Enter a valid qualifying position for every driver you fill in.";
    }
    positions.set(driverId, position);
  }
  if (new Set(positions.values()).size !== positions.size) {
    return "Two drivers can't share the same qualifying position.";
  }

  await prisma.$transaction((tx) => applyQualifyingResults(tx, race, positions));

  revalidatePath(`/races/${raceId}`);
  revalidatePath(`/admin/races/${raceId}`);
  redirect(`/admin/races/${raceId}`);
}
