"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { isSiteAdmin } from "@/lib/authz";
import { deleteLeague } from "@/lib/leagueDelete";

async function requireAdmin(): Promise<string | null> {
  const session = await auth();
  if (!session?.user?.id || !isSiteAdmin(session.user.email)) {
    return "Not authorized.";
  }
  return null;
}

export async function deleteLeagueAction(
  _prevState: string | undefined,
  formData: FormData,
): Promise<string | undefined> {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;

  const leagueId = formData.get("leagueId");
  const leagueName = formData.get("leagueName");
  const confirmName = formData.get("confirmName");
  if (typeof leagueId !== "string" || !leagueId || typeof leagueName !== "string") {
    return "Missing league.";
  }
  if (typeof confirmName !== "string" || confirmName.trim() !== leagueName.trim()) {
    return "Typed name didn't match — league not deleted.";
  }

  const result = await deleteLeague(leagueId);
  if (!result.ok) return result.error;

  revalidatePath("/admin/leagues");
  revalidatePath("/", "layout");
  return undefined;
}
