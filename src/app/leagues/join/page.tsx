import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import Card from "@/components/ui/Card";
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
      <Card>
        <p>Ask the league owner for their invite code.</p>
        <JoinLeagueForm />
      </Card>
    </main>
  );
}
