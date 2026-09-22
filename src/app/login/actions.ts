"use server";

import { AuthError } from "next-auth";
import { signIn } from "@/lib/auth";

export async function login(
  _prevState: string | undefined,
  formData: FormData,
): Promise<string | undefined> {
  try {
    await signIn("credentials", {
      username: formData.get("username"),
      password: formData.get("password"),
      redirectTo: "/",
    });
  } catch (error) {
    // signIn() redirects on success by throwing a special Next.js redirect
    // error — that's not an AuthError, so it falls through and propagates
    // (rethrowing it is what actually performs the redirect).
    if (error instanceof AuthError) {
      return "Invalid username or password.";
    }
    throw error;
  }
}
