"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isSiteAdmin } from "@/lib/authz";
import { applyRaceResults, notifyResultsPostedIfDue } from "@/lib/raceSync";

function parseOptionalStagePosition(formData: FormData, key: string): number | null {
  const raw = formData.get(key);
  if (typeof raw !== "string" || raw.trim() === "") return null;
  const n = parseInt(raw, 10);
  return Number.isInteger(n) && n >= 1 && n <= 10 ? n : null;
}

export async function submitResults(
  _prevState: string | undefined,
  formData: FormData,
): Promise<string | undefined> {
  const raceId = formData.get("raceId");
  const driverIds = formData.getAll("driverId");

  if (typeof raceId !== "string" || driverIds.length === 0) {
    return "Missing race or driver data.";
  }

  const session = await auth();
  if (!session?.user?.id || !isSiteAdmin(session.user.email)) {
    return "Not authorized.";
  }

  const race = await prisma.race.findUnique({ where: { id: raceId } });
  if (!race) {
    return "Race not found.";
  }

  // Only finishing positions for drivers someone actually picked are
  // collected (see ResultsForm) — that's the minimum needed to score every
  // pick on this race, across every league that shares it. Stage top-10s
  // are optional (blank = not top 10 that stage).
  const finishPositions = new Map<string, number>();
  const stage1Positions = new Map<string, number>();
  const stage2Positions = new Map<string, number>();
  for (const driverId of driverIds) {
    if (typeof driverId !== "string") continue;
    const raw = formData.get(`finish-${driverId}`);
    const finishPosition = typeof raw === "string" ? parseInt(raw, 10) : NaN;
    if (!Number.isInteger(finishPosition) || finishPosition < 1) {
      return "Enter a valid finishing position for every driver.";
    }
    finishPositions.set(driverId, finishPosition);

    const stage1 = parseOptionalStagePosition(formData, `stage1-${driverId}`);
    if (stage1 != null) stage1Positions.set(driverId, stage1);
    const stage2 = parseOptionalStagePosition(formData, `stage2-${driverId}`);
    if (stage2 != null) stage2Positions.set(driverId, stage2);
  }
  // A stage position can only be claimed by one driver.
  if (new Set(stage1Positions.values()).size !== stage1Positions.size) {
    return "Two drivers can't share the same Stage 1 finishing position.";
  }
  if (new Set(stage2Positions.values()).size !== stage2Positions.size) {
    return "Two drivers can't share the same Stage 2 finishing position.";
  }

  await prisma.$transaction((tx) => applyRaceResults(tx, race, finishPositions, stage1Positions, stage2Positions));

  try {
    await notifyResultsPostedIfDue(raceId);
  } catch {
    // Swallowed — the results themselves saved fine; a missed
    // notification isn't worth failing this admin action over.
  }

  revalidatePath(`/races/${raceId}`);
  revalidatePath(`/admin/races/${raceId}`);
  revalidatePath(`/stats`);
  redirect(`/admin/races/${raceId}`);
}
