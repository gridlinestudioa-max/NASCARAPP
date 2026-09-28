// A bare email has no spaces, so splitting it on " " for a first name
// returns the whole address — long enough to overflow a heading. Falling
// back to the local-part (before "@") instead keeps it short like a real
// first name would be.
export function firstNameFor(name: string | null | undefined, email: string | null | undefined): string {
  const trimmedName = name?.trim();
  if (trimmedName) return trimmedName.split(" ")[0];
  const trimmedEmail = email?.trim();
  if (trimmedEmail) return trimmedEmail.split("@")[0];
  return "there";
}
