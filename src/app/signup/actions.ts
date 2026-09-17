"use server";

import bcrypt from "bcryptjs";
import { AuthError } from "next-auth";
import { signIn } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function signup(
  _prevState: string | undefined,
  formData: FormData,
): Promise<string | undefined> {
  const email = formData.get("email");
  const name = formData.get("name");
  const username = formData.get("username");
  const password = formData.get("password");
  const confirmPassword = formData.get("confirmPassword");

  if (
    typeof email !== "string" ||
    typeof name !== "string" ||
    typeof username !== "string" ||
    typeof password !== "string" ||
    typeof confirmPassword !== "string"
  ) {
    return "All fields are required.";
  }

  const trimmedEmail = email.trim().toLowerCase();
  const trimmedName = name.trim();
  const trimmedUsername = username.trim();

  if (!trimmedEmail.includes("@")) {
    return "Enter a valid email address.";
  }
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
    await prisma.user.create({
      data: {
        email: trimmedEmail,
        name: trimmedName || null,
        username: trimmedUsername,
        passwordHash,
      },
    });
  } catch (error) {
    if (
      error instanceof Error &&
      "code" in error &&
      (error as { code?: string }).code === "P2002"
    ) {
      return "An account with that email or username already exists.";
    }
    throw error;
  }

  try {
    await signIn("credentials", {
      username: trimmedUsername,
      password,
      redirectTo: "/my-leagues",
    });
  } catch (error) {
    // signIn() redirects on success by throwing a special Next.js redirect
    // error — that's not an AuthError, so it falls through and propagates
    // (rethrowing it is what actually performs the redirect).
    if (error instanceof AuthError) {
      return "Account created — sign in below.";
    }
    throw error;
  }
}
