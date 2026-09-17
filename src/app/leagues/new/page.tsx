import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import CreateLeagueForm from "./CreateLeagueForm";

export default async function NewLeaguePage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  return (
    <main>
      <p>
        <Link href="/my-leagues">&larr; My Leagues</Link>
      </p>
      <h1>Create a league</h1>
      <p>You&apos;ll be the owner and can invite others once it&apos;s created.</p>
      <CreateLeagueForm />
    </main>
  );
}
