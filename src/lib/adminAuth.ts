import { auth } from "./auth";
import { isSiteAdmin } from "./authz";

export type AdminCheck = { error: string; adminId?: undefined } | { error: null; adminId: string };

// Every admin server action (delete a league, delete a user, merge
// drivers, ...) starts with the same "am I actually the site admin"
// check. One place for it means a change to what counts as admin (a
// second admin email, a role column) only has to happen here.
export async function requireAdmin(): Promise<AdminCheck> {
  const session = await auth();
  if (!session?.user?.id || !isSiteAdmin(session.user.email)) {
    return { error: "Not authorized." };
  }
  return { error: null, adminId: session.user.id };
}
