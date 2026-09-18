import { prisma } from "@/lib/prisma";
import Card from "@/components/ui/Card";
import ClaimForm from "./ClaimForm";

export const dynamic = "force-dynamic";

export default async function ClaimPage() {
  const users = await prisma.user.findMany({
    where: { passwordHash: null },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  return (
    <main>
      <h1>Claim your account</h1>
      <Card>
        <p style={{ marginBottom: "var(--space-3)" }}>
          Pick your name and set a username and password to log in going forward.
        </p>
        <ClaimForm users={users} />
      </Card>
    </main>
  );
}
