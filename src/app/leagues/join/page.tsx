import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import Card from "@/components/ui/Card";
import Breadcrumb from "@/components/ui/Breadcrumb";
import JoinLeagueForm from "./JoinLeagueForm";

export default async function JoinLeaguePage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  return (
    <main>
      <Breadcrumb items={[{ label: "Home", href: "/" }, { label: "Join a League" }]} />
      <h1>Join a league</h1>
      <Card>
        <p>Ask the league owner for their invite code.</p>
        <JoinLeagueForm />
      </Card>
    </main>
  );
}
