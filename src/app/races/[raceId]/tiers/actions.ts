"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ownsALeagueInSeason } from "@/lib/authz";
import type { DriverTier } from "@/lib/tieredDraft";

function parseTier(value: FormDataEntryValue | null): DriverTier | null {
  return value === "A" || value === "B" || value === "C" ? value : null;
}

export async function submitTiers(_prevState: string | undefined, formData: FormData): Promise<string | undefined> {
  const raceId = formData.get("raceId");
  if (typeof raceId !== "string") {
    return "Missing race.";
  }

  const session = await auth();
  if (!session?.user?.id) {
    return "You need to be signed in to assign tiers.";
  }

  const race = await prisma.race.findUnique({ where: { id: raceId } });
  if (!race) {
    return "Race not found.";
  }

  const authorized = await ownsALeagueInSeason(session.user.id, race.seasonId);
  if (!authorized) {
    return "Only a league owner in this season can assign tiers.";
  }

  const drivers = await prisma.driver.findMany({ where: { isActive: true }, select: { id: true } });

  await prisma.$transaction(async (tx) => {
    for (const driver of drivers) {
      const tier = parseTier(formData.get(`tier-${driver.id}`));
      if (tier) {
        await tx.driverTierAssignment.upsert({
          where: { raceId_driverId: { raceId, driverId: driver.id } },
          update: { tier },
          create: { raceId, driverId: driver.id, tier },
        });
      } else {
        await tx.driverTierAssignment.deleteMany({ where: { raceId, driverId: driver.id } });
      }
    }
  });

  revalidatePath(`/races/${raceId}/tiers`);
  revalidatePath(`/races/${raceId}/qualifying`);
  redirect(`/races/${raceId}`);
}
