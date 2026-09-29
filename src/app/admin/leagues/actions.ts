"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/adminAuth";
import { deleteLeague } from "@/lib/leagueDelete";

export async function deleteLeagueAction(
  _prevState: string | undefined,
  formData: FormData,
): Promise<string | undefined> {
  const { error: unauthorized } = await requireAdmin();
  if (unauthorized) return unauthorized;

  const leagueId = formData.get("id");
  const leagueName = formData.get("name");
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
