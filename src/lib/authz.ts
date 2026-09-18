// Schedule, entry lists, qualifying, and results are facts about what
// actually happened on track — not something any league commissioner
// should be able to edit, since a change there would silently rewrite
// scoring for every league sharing that data. Single site admin, set by
// email via the ADMIN_EMAIL env var rather than a DB column, since
// there's exactly one and it shouldn't require a schema change (or a
// hand-verified production migration) to grant or revoke.
export function isSiteAdmin(email: string | null | undefined): boolean {
  const adminEmail = process.env.ADMIN_EMAIL;
  if (!adminEmail || !email) return false;
  return email.trim().toLowerCase() === adminEmail.trim().toLowerCase();
}
