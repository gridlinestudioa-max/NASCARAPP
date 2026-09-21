"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export type FormState = { kind: "error" | "status"; message: string } | undefined;

function isUniqueConstraintError(error: unknown): boolean {
  return error instanceof Error && "code" in error && (error as { code?: string }).code === "P2002";
}

export async function updateProfile(_prevState: FormState, formData: FormData): Promise<FormState> {
  const session = await auth();
  if (!session?.user?.id) {
    return { kind: "error", message: "You're not signed in." };
  }

  const name = formData.get("name");
  if (typeof name !== "string") {
    return { kind: "error", message: "Enter a display name." };
  }
  const trimmed = name.trim();

  await prisma.user.update({ where: { id: session.user.id }, data: { name: trimmed || null } });
  revalidatePath("/settings");
  return { kind: "status", message: "Display name saved." };
}

export async function updateAccount(_prevState: FormState, formData: FormData): Promise<FormState> {
  const session = await auth();
  if (!session?.user?.id) {
    return { kind: "error", message: "You're not signed in." };
  }

  const email = formData.get("email");
  const username = formData.get("username");
  const currentPassword = formData.get("currentPassword");
  if (typeof email !== "string" || typeof username !== "string" || typeof currentPassword !== "string") {
    return { kind: "error", message: "All fields are required." };
  }

  const trimmedEmail = email.trim().toLowerCase();
  const trimmedUsername = username.trim();
  if (!trimmedEmail.includes("@")) {
    return { kind: "error", message: "Enter a valid email address." };
  }
  if (trimmedUsername.length < 3) {
    return { kind: "error", message: "Username must be at least 3 characters." };
  }

  const user = await prisma.user.findUnique({ where: { id: session.user.id } });
  if (!user || !user.passwordHash) {
    return { kind: "error", message: "This account has no password set yet — use the forgot password flow first." };
  }
  const valid = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!valid) {
    return { kind: "error", message: "Current password is incorrect." };
  }

  try {
    await prisma.user.update({
      where: { id: session.user.id },
      data: { email: trimmedEmail, username: trimmedUsername },
    });
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      return { kind: "error", message: "That email or username is already in use by another account." };
    }
    throw error;
  }

  revalidatePath("/settings");
  return {
    kind: "status",
    message: "Account updated. Some places (like the sidebar) may keep showing the old value until you sign in again.",
  };
}

export async function updatePassword(_prevState: FormState, formData: FormData): Promise<FormState> {
  const session = await auth();
  if (!session?.user?.id) {
    return { kind: "error", message: "You're not signed in." };
  }

  const currentPassword = formData.get("currentPassword");
  const newPassword = formData.get("newPassword");
  const confirmPassword = formData.get("confirmPassword");
  if (
    typeof currentPassword !== "string" ||
    typeof newPassword !== "string" ||
    typeof confirmPassword !== "string"
  ) {
    return { kind: "error", message: "All fields are required." };
  }
  if (newPassword.length < 8) {
    return { kind: "error", message: "New password must be at least 8 characters." };
  }
  if (newPassword !== confirmPassword) {
    return { kind: "error", message: "New passwords don't match." };
  }

  const user = await prisma.user.findUnique({ where: { id: session.user.id } });
  if (!user || !user.passwordHash) {
    return { kind: "error", message: "This account has no password set yet — use the forgot password flow first." };
  }
  const valid = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!valid) {
    return { kind: "error", message: "Current password is incorrect." };
  }

  const passwordHash = await bcrypt.hash(newPassword, 10);
  await prisma.user.update({ where: { id: session.user.id }, data: { passwordHash } });

  return { kind: "status", message: "Password changed." };
}

export async function updateNotifications(_prevState: FormState, formData: FormData): Promise<FormState> {
  const session = await auth();
  if (!session?.user?.id) {
    return { kind: "error", message: "You're not signed in." };
  }

  const notifyResultsEmail = formData.get("notifyResultsEmail") === "on";

  await prisma.user.update({ where: { id: session.user.id }, data: { notifyResultsEmail } });
  revalidatePath("/settings");
  return { kind: "status", message: "Notification preferences saved." };
}
