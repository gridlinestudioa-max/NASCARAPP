import { prisma } from "@/lib/prisma";
import Card from "@/components/ui/Card";
import HistoricalImportPanel from "./HistoricalImportPanel";

export const dynamic = "force-dynamic";

export default async function HistoricalImportPage() {
  const [raceCount, driverCount] = await Promise.all([
    prisma.historicalRaceResult.count(),
    prisma.historicalRaceResult.findMany({ distinct: ["driverId"], select: { driverId: true } }).then((r) => r.length),
  ]);
  const yearRange = await prisma.historicalRaceResult.aggregate({ _min: { year: true }, _max: { year: true } });

  return (
    <main>
      <h1>Historical results import</h1>
      <p>
        One-time backfill of the 8 seasons before this one, pulled from NASCAR&apos;s own feed — gives the
        auto-tier formula&apos;s track-history component real data instead of starting neutral for every driver.
        Safe to click repeatedly: each click processes a bounded batch and skips anything already imported.
      </p>
      <Card>
        <p>
          {raceCount} result{raceCount === 1 ? "" : "s"} imported so far, across {driverCount} driver
          {driverCount === 1 ? "" : "s"}
          {yearRange._min.year && yearRange._max.year ? ` (${yearRange._min.year}-${yearRange._max.year})` : ""}.
        </p>
        <HistoricalImportPanel />
      </Card>
    </main>
  );
}
