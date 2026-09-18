"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isSiteAdmin } from "@/lib/authz";
import type { DriverTier } from "@/lib/tieredDraft";
import { applyAutoTiers } from "@/lib/tierRanking";

function parseTier(value: FormDataEntryValue | null): DriverTier | null {
  return value === "A" || value === "B" || value === "C" ? value : null;
}

export async function submitTiers(_prevState: string | undefined, formData: FormData): Promise<string | undefined> {
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

  revalidatePath(`/admin/races/${raceId}/tiers`);
  revalidatePath(`/admin/races/${raceId}/qualifying`);
  redirect(`/admin/races/${raceId}`);
}

// Computes tiers from season points/recent form/track history and
// pre-fills them as this race's DriverTierAssignment rows — the
// commissioner still reviews and can adjust every value on this same page
// before saving, exactly as if they'd been entered by hand.
export async function autoAssignTiers(raceId: string): Promise<string> {
  const session = await auth();
  if (!session?.user?.id || !isSiteAdmin(session.user.email)) {
    return "Not authorized.";
  }

  const race = await prisma.race.findUnique({ where: { id: raceId } });
  if (!race) {
    return "Race not found.";
  }

  const outcome = await applyAutoTiers(raceId);
  revalidatePath(`/admin/races/${raceId}/tiers`);
  if (!outcome.ok) {
    return outcome.error;
  }

  const counts = { A: 0, B: 0, C: 0 };
  for (const t of outcome.tiers) counts[t.tier]++;
  const summary = `Assigned ${outcome.tiers.length} drivers (A: ${counts.A}, B: ${counts.B}, C: ${counts.C}). Review below before saving.`;
  return outcome.warnings.length > 0 ? `${summary} ${outcome.warnings.join(" ")}` : summary;
}
