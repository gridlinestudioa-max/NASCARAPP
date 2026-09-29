import { Skeleton, SkeletonCard } from "@/components/ui/Skeleton";

export default function StatsLoading() {
  return (
    <main>
      <Skeleton width={140} height={14} radius={4} style={{ marginBottom: "var(--space-4)" }} />
      <Skeleton width={180} height={28} radius={6} style={{ marginBottom: "var(--space-4)" }} />
      <SkeletonCard title={false} rows={8} />
    </main>
  );
}
