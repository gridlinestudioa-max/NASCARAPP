import { redirect } from "next/navigation";

// The My Leagues dashboard moved to the home screen ("/") — this route
// stays as a redirect for anyone with an old bookmark or link.
export default function MyLeaguesRedirect() {
  redirect("/");
}
