"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { isSiteAdmin } from "@/lib/authz";
import { deleteUser } from "@/lib/userDelete";

async function requireAdmin(): Promise<{ error: string | null; adminId: string | null }> {
  const session = await auth();
  if (!session?.user?.id || !isSiteAdmin(session.user.email)) {
    return { error: "Not authorized.", adminId: null };
  }
  return { error: null, adminId: session.user.id };
}

export async function deleteUserAction(
  _prevState: string | undefined,
  formData: FormData,
): Promise<string | undefined> {
  const { error: unauthorized, adminId } = await requireAdmin();
  if (unauthorized) return unauthorized;

  const userId = formData.get("userId");
  const identifier = formData.get("identifier");
  const confirmIdentifier = formData.get("confirmIdentifier");
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
