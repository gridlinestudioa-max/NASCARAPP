"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { isSiteAdmin } from "@/lib/authz";
import { mergeDrivers } from "@/lib/driverMerge";

async function requireAdmin(): Promise<string | null> {
  const session = await auth();
  if (!session?.user?.id || !isSiteAdmin(session.user.email)) {
    return "Not authorized.";
  }
  return null;
}

function revalidateEverywhere() {
  revalidatePath("/admin/drivers");
  revalidatePath("/admin/season-setup");
  revalidatePath("/", "layout");
  revalidatePath("/stats");
  revalidatePath("/races");
}

export async function mergeDriversAction(
  _prevState: string | undefined,
  formData: FormData,
): Promise<string | undefined> {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;

  const keepId = formData.get("keepId");
  const mergeId = formData.get("mergeId");
  if (typeof keepId !== "string" || typeof mergeId !== "string" || !keepId || !mergeId) {
    return "Pick both a driver to keep and one to merge away.";
  }

  const result = await mergeDrivers(keepId, mergeId);
  if (!result.ok) return result.error;

  revalidateEverywhere();
  return undefined;
}
