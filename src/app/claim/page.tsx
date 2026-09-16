import { prisma } from "@/lib/prisma";
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
      <p>Pick your name and set a username and password to log in going forward.</p>
      <ClaimForm users={users} />
    </main>
  );
}
