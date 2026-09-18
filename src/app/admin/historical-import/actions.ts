"use server";

import { auth } from "@/lib/auth";
import { isSiteAdmin } from "@/lib/authz";
import { importHistoricalResults } from "@/lib/historicalImport";

// Runs one bounded batch of the historical-results import (see
// historicalImport.ts) and reports progress — click again to continue
// until it reports nothing left.
export async function runHistoricalImportBatch(): Promise<string> {
  const session = await auth();
  if (!session?.user?.id || !isSiteAdmin(session.user.email)) {
    return "Not authorized.";
  }

  const outcome = await importHistoricalResults();
  return outcome.ok ? outcome.message : outcome.error;
}
