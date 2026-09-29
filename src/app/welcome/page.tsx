import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import Card from "@/components/ui/Card";
import InstallAppCard from "@/components/install/InstallAppCard";
import { firstNameFor } from "@/lib/displayName";
import styles from "./page.module.css";

export default async function WelcomePage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }
  const firstName = firstNameFor(session.user.name, session.user.email);

  return (
    <main>
      <h1>Welcome, {firstName}!</h1>
      <p className={styles.sub}>Your account is ready. One more thing before you dive in.</p>

      <Card title="Add to your home screen">
        <p>
          <small>
            Install FindTheGroove for a full-screen, app-like experience — quick access from your home screen,
            no browser bar.
          </small>
        </p>
        <InstallAppCard />
      </Card>

      <Link href="/" className={`linkButton ${styles.continue}`}>
        Continue to your dashboard →
      </Link>
    </main>
  );
}
