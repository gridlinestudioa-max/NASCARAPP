import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import Card from "@/components/ui/Card";
import Breadcrumb from "@/components/ui/Breadcrumb";
import ProfileForm from "./ProfileForm";
import AccountForm from "./AccountForm";
import PasswordForm from "./PasswordForm";
import NotificationsForm from "./NotificationsForm";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const user = await prisma.user.findUnique({ where: { id: session.user.id } });
  if (!user) {
    redirect("/login");
  }

  return (
    <main>
      <Breadcrumb items={[{ label: "Dashboards" }, { label: "Settings" }]} />
      <h1>Settings</h1>

      <Card title="Profile">
        <p>
          <small>
            Your display name doubles as your team name — it&apos;s what other players see in standings, picks, and
            everywhere else across every league you&apos;re in.
          </small>
        </p>
        <ProfileForm name={user.name ?? ""} />
      </Card>

      <Card title="Account">
        <p>
          <small>Changing either of these requires your current password.</small>
        </p>
        <AccountForm email={user.email} username={user.username ?? ""} />
      </Card>

      <Card title="Password">
        <PasswordForm />
      </Card>

      <Card title="Notifications">
        <NotificationsForm notifyResultsEmail={user.notifyResultsEmail} />
      </Card>
    </main>
  );
}
