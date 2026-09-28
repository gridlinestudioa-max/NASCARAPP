import { Skeleton, SkeletonCard } from "@/components/ui/Skeleton";
import styles from "./page.module.css";

// Next's route-level Suspense fallback for "/" — shown the instant a
// client-side navigation lands here, for as long as the real page's
// Prisma queries take (this route is force-dynamic, so that's every
// visit). Shaped to roughly match the real Home layout (My Leagues card +
// the two-up schedule/driver-points row) so the swap-in doesn't jump.
export default function HomeLoading() {
  return (
    <main>
      <Skeleton width={220} height={28} radius={6} style={{ marginBottom: "var(--space-4)" }} />
      <SkeletonCard rows={4} />
      <div className={styles.snapshotRow}>
        <SkeletonCard rows={4} />
        <SkeletonCard rows={4} />
      </div>
    </main>
  );
}
