"use server";

import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";

export async function claimAccount(
  _prevState: string | undefined,
  formData: FormData,
): Promise<string | undefined> {
  const userId = formData.get("userId");
  const username = formData.get("username");
  const password = formData.get("password");
  const confirmPassword = formData.get("confirmPassword");

  if (
    typeof userId !== "string" ||
    typeof username !== "string" ||
    typeof password !== "string" ||
    typeof confirmPassword !== "string"
  ) {
    return "All fields are required.";
  }

  const trimmedUsername = username.trim();
  if (trimmedUsername.length < 3) {
    return "Username must be at least 3 characters.";
  }
  if (password.length < 8) {
    return "Password must be at least 8 characters.";
  }
  if (password !== confirmPassword) {
    return "Passwords don't match.";
  }

  const passwordHash = await bcrypt.hash(password, 10);

  try {
    // updateMany + where passwordHash: null guards against a double-claim
    // race (two requests for the same still-unclaimed account at once).
    const result = await prisma.user.updateMany({
      where: { id: userId, passwordHash: null },
      data: { username: trimmedUsername, passwordHash },
    });

    if (result.count === 0) {
      return "That account has already been claimed.";
    }
  } catch (error) {
    if (
      error instanceof Error &&
      "code" in error &&
      (error as { code?: string }).code === "P2002"
    ) {
      return "That username is already taken.";
    }
    throw error;
  }

  redirect("/login?claimed=1");
}
