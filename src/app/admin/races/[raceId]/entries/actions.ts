"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isSiteAdmin } from "@/lib/authz";
import { applyRaceEntries } from "@/lib/raceSync";
import { parseEntryListText } from "@/lib/entryListParser";

export async function submitEntryList(
  _prevState: string | undefined,
  formData: FormData,
): Promise<string | undefined> {
  const raceId = formData.get("raceId");
  const entryListText = formData.get("entryList");

  if (typeof raceId !== "string" || typeof entryListText !== "string") {
    return "Missing race or entry list data.";
  }

  const session = await auth();
  if (!session?.user?.id || !isSiteAdmin(session.user.email)) {
    return "Not authorized.";
  }

  const race = await prisma.race.findUnique({ where: { id: raceId } });
  if (!race) {
    return "Race not found.";
  }

  const entries = parseEntryListText(entryListText);
  if (entries.length === 0) {
    return "Paste at least one driver.";
  }
  const names = new Set(entries.map((e) => e.driverName.toLowerCase()));
  if (names.size !== entries.length) {
    return "The same driver appears more than once.";
  }

  await prisma.$transaction(async (tx) => {
    const driverIdByName = await applyRaceEntries(tx, raceId, entries);
    // Replace, not merge — a driver dropped from last time's paste should
    // stop being pickable this week, not linger from a stale upsert.
    await tx.raceEntry.deleteMany({
      where: { raceId, driverId: { notIn: [...driverIdByName.values()] } },
    });
  });

  revalidatePath(`/races/${raceId}`);
  revalidatePath(`/admin/races/${raceId}`);
  revalidatePath(`/admin/races/${raceId}/entries`);
  redirect(`/admin/races/${raceId}`);
}
