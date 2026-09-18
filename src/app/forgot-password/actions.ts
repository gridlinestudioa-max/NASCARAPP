"use server";

import crypto from "node:crypto";
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { sendPasswordResetEmail } from "@/lib/email";

const TOKEN_TTL_MS = 30 * 60 * 1000;
// A resend cooldown, not a real rate limit — just enough to stop one click
// (or one script) from queuing up a burst of reset emails for an account.
const MIN_RESEND_INTERVAL_MS = 60 * 1000;

function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export type RequestResetState = { kind: "error" | "status"; message: string } | undefined;

// Always the same message whether or not the username exists — a
// different response for "no such account" would let anyone use this form
// to enumerate registered usernames.
const GENERIC_RESPONSE: RequestResetState = {
  kind: "status",
  message: "If that account exists, we've sent a password reset link to the email on file.",
};

export async function requestPasswordReset(
  _prevState: RequestResetState,
  formData: FormData,
): Promise<RequestResetState> {
  const username = formData.get("username");
  if (typeof username !== "string" || username.trim().length === 0) {
    return { kind: "error", message: "Enter your username." };
  }

  const user = await prisma.user.findUnique({ where: { username: username.trim() } });
  if (!user) {
    return GENERIC_RESPONSE;
  }

  const recentToken = await prisma.passwordResetToken.findFirst({
    where: { userId: user.id, createdAt: { gte: new Date(Date.now() - MIN_RESEND_INTERVAL_MS) } },
    orderBy: { createdAt: "desc" },
  });
  if (recentToken) {
    return GENERIC_RESPONSE;
  }

  const rawToken = crypto.randomBytes(32).toString("hex");
  await prisma.passwordResetToken.create({
    data: {
      userId: user.id,
      tokenHash: hashToken(rawToken),
      expiresAt: new Date(Date.now() + TOKEN_TTL_MS),
    },
  });

  const requestHeaders = await headers();
  const host = requestHeaders.get("host");
  const proto = requestHeaders.get("x-forwarded-proto") ?? (host?.startsWith("localhost") ? "http" : "https");
  const resetUrl = `${proto}://${host}/reset-password?token=${rawToken}`;

  await sendPasswordResetEmail(user.email, resetUrl);

  return GENERIC_RESPONSE;
}
