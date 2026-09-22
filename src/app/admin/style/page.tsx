import Breadcrumb from "@/components/ui/Breadcrumb";
import GlobalStyleForm from "@/components/admin/GlobalStyleForm";
import { getAppTheme } from "@/lib/theme";

export const dynamic = "force-dynamic";

export default async function GlobalStylePage() {
  const theme = await getAppTheme();

  return (
    <main>
      <Breadcrumb items={[{ label: "Dashboards" }, { label: "Admin", href: "/admin" }, { label: "Global Style" }]} />
      <h1>Global Style</h1>
      <p>Change these and every page in the app picks it up.</p>
      <GlobalStyleForm initialTheme={theme} />
    </main>
  );
}
