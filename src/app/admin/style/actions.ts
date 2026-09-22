"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { isSiteAdmin } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { DEFAULT_THEME, type AppTheme } from "@/lib/themeVars";

async function requireAdmin() {
  const session = await auth();
  if (!session?.user?.email || !isSiteAdmin(session.user.email)) {
    throw new Error("Not authorized");
  }
}

export async function updateAppTheme(partial: Partial<AppTheme>) {
  await requireAdmin();
  await prisma.appTheme.upsert({
    where: { id: "singleton" },
    create: { id: "singleton", ...DEFAULT_THEME, ...partial },
    update: partial,
  });
  // The theme is read once, server-side, in the root layout — every page
  // shares that same layout render, so this one revalidate is what makes
  // the change visible everywhere instantly rather than on next deploy.
  revalidatePath("/", "layout");
}

export async function resetAppTheme() {
  await requireAdmin();
  await prisma.appTheme.upsert({
    where: { id: "singleton" },
    create: { id: "singleton", ...DEFAULT_THEME },
    update: { ...DEFAULT_THEME },
  });
  revalidatePath("/", "layout");
}
