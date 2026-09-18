import type { ReactNode } from "react";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { isSiteAdmin } from "@/lib/authz";

export const dynamic = "force-dynamic";

// Single gate for every /admin/* route. Not signed in gets the ordinary
// login redirect (same as any other protected page); signed in but not
// the admin gets notFound() rather than an access-denied page — same
// "hide that it exists" treatment the league hub gives a non-member, so
// this section isn't discoverable at all to anyone but the one admin.
export default async function AdminLayout({ children }: { children: ReactNode }) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }
  if (!isSiteAdmin(session.user.email)) {
    notFound();
  }

  return <>{children}</>;
}
