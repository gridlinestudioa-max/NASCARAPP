import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { isSiteAdmin } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import Card from "@/components/ui/Card";
import CardGrid from "@/components/ui/CardGrid";
import Breadcrumb from "@/components/ui/Breadcrumb";
import { findLikelyDuplicateDriverPairs } from "@/lib/driverMerge";
import DriverMergeForm from "./DriverMergeForm";
import ManualMergePicker from "./ManualMergePicker";
import styles from "./page.module.css";

export const dynamic = "force-dynamic";

export default async function AdminDriversPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  if (!isSiteAdmin(session.user.email)) redirect("/admin");

  const drivers = await prisma.driver.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true, number: true },
  });

  const duplicates = findLikelyDuplicateDriverPairs(drivers);

  return (
    <main>
      <Breadcrumb items={[{ label: "Dashboards" }, { label: "Admin", href: "/admin" }, { label: "Drivers" }]} />
      <h1>Drivers</h1>
      <p>
        The NASCAR feed only self-corrects a name that differs from ours by case or spacing — anything else (a
        missing middle name, a punctuation difference, a typo) quietly creates a second driver instead of matching
        the existing one. Use this page to catch and fix those.
      </p>

      <CardGrid>
        <Card title="Possible duplicates">
          {duplicates.length === 0 ? (
            <p className={styles.empty}>No likely duplicates found among {drivers.length} drivers.</p>
          ) : (
            <ul className={styles.candidateList}>
              {duplicates.map(({ a, b, reason }) => (
                <li key={`${a.id}-${b.id}`} className={styles.candidate}>
                  <p className={styles.reason}>{reason}</p>
                  <DriverMergeForm a={a} b={b} />
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="Merge any two drivers">
          <p>
            <small>For a duplicate the automatic check above didn&apos;t catch.</small>
          </p>
          <ManualMergePicker drivers={drivers} />
        </Card>
      </CardGrid>
    </main>
  );
}
