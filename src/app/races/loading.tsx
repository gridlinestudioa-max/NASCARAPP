import { Skeleton, SkeletonCard } from "@/components/ui/Skeleton";

export default function ScheduleLoading() {
  return (
    <main>
      <Skeleton width={140} height={14} radius={4} style={{ marginBottom: "var(--space-4)" }} />
      <Skeleton width={160} height={28} radius={6} style={{ marginBottom: "var(--space-4)" }} />
      <SkeletonCard title={false} rows={6} />
      <SkeletonCard title={false} rows={6} />
    </main>
  );
}
