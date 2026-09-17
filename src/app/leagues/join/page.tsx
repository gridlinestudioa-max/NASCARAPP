import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import JoinLeagueForm from "./JoinLeagueForm";

export default async function JoinLeaguePage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  return (
    <main>
      <p>
        <Link href="/my-leagues">&larr; My Leagues</Link>
      </p>
      <h1>Join a league</h1>
      <p>Ask the league owner for their invite code.</p>
      <JoinLeagueForm />
    </main>
  );
}
