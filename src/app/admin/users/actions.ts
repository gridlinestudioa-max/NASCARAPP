"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/adminAuth";
import { deleteUser } from "@/lib/userDelete";

export async function deleteUserAction(
  _prevState: string | undefined,
  formData: FormData,
): Promise<string | undefined> {
  const { error: unauthorized, adminId } = await requireAdmin();
  if (unauthorized) return unauthorized;

  const userId = formData.get("id");
  const identifier = formData.get("name");
  const confirmIdentifier = formData.get("confirmName");
  if (typeof userId !== "string" || !userId || typeof identifier !== "string") {
    return "Missing user.";
  }
  if (userId === adminId) {
    return "You can't delete your own admin account.";
  }
  if (typeof confirmIdentifier !== "string" || confirmIdentifier.trim() !== identifier.trim()) {
    return "Typed name/email didn't match — user not deleted.";
  }

  const result = await deleteUser(userId);
  if (!result.ok) return result.error;

  revalidatePath("/admin/users");
  revalidatePath("/", "layout");
  return undefined;
}
