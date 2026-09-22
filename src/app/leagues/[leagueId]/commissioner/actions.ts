"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { LeagueType } from "@prisma/client";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { parseRuleSetConfig, type PickemRuleSetConfig } from "@/lib/scoring";
import { parseTieredDraftRuleSetConfig, type TieredDraftRuleSetConfig } from "@/lib/tieredDraft";
import { PICK_ORDER_MODES, sanitizePickOrder, type PickOrderMode } from "@/lib/pickOrder";

// Rules are versioned, never edited in place (see RuleSet's schema
// comment) — changing them creates a new RuleSet row and repoints the
// league's current LeagueSeason at it. Already-recorded Scores keep
// whatever values they were computed under; only future scoring (new
// picks, or results entered/edited from here on) uses the new rules.
export async function updateLeagueRules(
  leagueId: string,
  leagueType: LeagueType,
  rawConfig: PickemRuleSetConfig | TieredDraftRuleSetConfig,
): Promise<string | undefined> {
  const session = await auth();
  if (!session?.user?.id) {
    return "You need to be signed in.";
  }
  const userId = session.user.id;

  const membership = await prisma.leagueMembership.findUnique({
    where: { leagueId_userId: { leagueId, userId } },
  });
  if (!membership || membership.role !== "OWNER") {
    return "Only the league commissioner can change its rules.";
  }

  const league = await prisma.league.findUnique({ where: { id: leagueId } });
  if (!league || league.type !== leagueType) {
    return "League not found.";
  }

  const config: PickemRuleSetConfig | TieredDraftRuleSetConfig =
    leagueType === "TIERED_DRAFT"
      ? parseTieredDraftRuleSetConfig(rawConfig)
      : parseRuleSetConfig(rawConfig as PickemRuleSetConfig);

  const leagueSeason = await prisma.leagueSeason.findFirst({
    where: { leagueId },
    include: { season: true },
    orderBy: { season: { year: "desc" } },
  });
  if (!leagueSeason) {
    return "This league isn't part of a season yet.";
  }

  await prisma.$transaction(async (tx) => {
    const ruleSet = await tx.ruleSet.create({
      data: { leagueId, label: `${leagueSeason.season.year} Season Rules (updated)`, config },
    });
    await tx.leagueSeason.update({ where: { id: leagueSeason.id }, data: { ruleSetId: ruleSet.id } });
  });

  revalidatePath(`/leagues/${leagueId}`);
  redirect(`/leagues/${leagueId}`);
}

// Pick order isn't versioned like RuleSet — it's a live setting, so
// changing it takes effect on whatever week is currently open for picks.
export async function updatePickOrder(
  _prevState: string | undefined,
  formData: FormData,
): Promise<string | undefined> {
  const leagueId = formData.get("leagueId");
  const mode = formData.get("mode");
  const orderRaw = formData.get("order");

  if (typeof leagueId !== "string" || typeof mode !== "string" || typeof orderRaw !== "string") {
    return "Missing pick order settings.";
  }
  if (!PICK_ORDER_MODES.includes(mode as PickOrderMode)) {
    return "Unknown pick order mode.";
  }

  const session = await auth();
  if (!session?.user?.id) {
    return "You need to be signed in.";
  }
  const userId = session.user.id;

  const membership = await prisma.leagueMembership.findUnique({
    where: { leagueId_userId: { leagueId, userId } },
  });
  if (!membership || membership.role !== "OWNER") {
    return "Only the league commissioner can change the pick order.";
  }

  const league = await prisma.league.findUnique({ where: { id: leagueId } });
  if (!league || league.type !== "PICKEM") {
    return "This league doesn't use a pick order.";
  }

  const members = await prisma.leagueMembership.findMany({ where: { leagueId }, select: { userId: true } });
  const submittedOrder = orderRaw.split(",").filter(Boolean);
  // Sanitize against actual membership rather than trusting the client's
  // hidden field outright — drops anyone no longer a member, keeps
  // anyone missing appended at the end.
  const order = sanitizePickOrder(submittedOrder, members.map((m) => m.userId));

  await prisma.league.update({
    where: { id: leagueId },
    data: { pickOrderMode: mode as PickOrderMode, pickOrder: order },
  });

  revalidatePath(`/leagues/${leagueId}/commissioner`);
  return undefined;
}

// Called directly (not through useActionState/FormData) by ImageUploadField
// right after a league icon finishes uploading to Blob storage.
export async function setLeagueIcon(leagueId: string, iconUrl: string | null): Promise<{ error?: string }> {
  const session = await auth();
  if (!session?.user?.id) {
    return { error: "You need to be signed in." };
  }

  const membership = await prisma.leagueMembership.findUnique({
    where: { leagueId_userId: { leagueId, userId: session.user.id } },
  });
  if (!membership || membership.role !== "OWNER") {
    return { error: "Only the league commissioner can set its icon." };
  }

  await prisma.league.update({ where: { id: leagueId }, data: { iconUrl } });

  revalidatePath(`/leagues/${leagueId}`);
  revalidatePath("/", "layout");
  return {};
}

export async function transferCommissioner(
  _prevState: string | undefined,
  formData: FormData,
): Promise<string | undefined> {
  const leagueId = formData.get("leagueId");
  const newOwnerUserId = formData.get("newOwnerUserId");
  if (typeof leagueId !== "string" || typeof newOwnerUserId !== "string" || !newOwnerUserId) {
    return "Select a player to hand the commissioner role to.";
  }

  const session = await auth();
  if (!session?.user?.id) {
    return "You need to be signed in.";
  }
  const userId = session.user.id;

  const membership = await prisma.leagueMembership.findUnique({
    where: { leagueId_userId: { leagueId, userId } },
  });
  if (!membership || membership.role !== "OWNER") {
    return "Only the current commissioner can transfer this role.";
  }
  if (newOwnerUserId === userId) {
    return "You're already the commissioner.";
  }

  const newOwnerMembership = await prisma.leagueMembership.findUnique({
    where: { leagueId_userId: { leagueId, userId: newOwnerUserId } },
  });
  if (!newOwnerMembership) {
    return "That player isn't a member of this league.";
  }

  await prisma.$transaction([
    prisma.league.update({ where: { id: leagueId }, data: { ownerId: newOwnerUserId } }),
    prisma.leagueMembership.update({ where: { id: membership.id }, data: { role: "MEMBER" } }),
    prisma.leagueMembership.update({ where: { id: newOwnerMembership.id }, data: { role: "OWNER" } }),
  ]);

  revalidatePath(`/leagues/${leagueId}`);
  revalidatePath(`/leagues/${leagueId}/commissioner`);
  redirect(`/leagues/${leagueId}/commissioner`);
}
