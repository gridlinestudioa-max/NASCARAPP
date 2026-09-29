import { Skeleton, SkeletonCard } from "@/components/ui/Skeleton";

export default function RaceLoading() {
  return (
    <main>
      <Skeleton width={140} height={14} radius={4} style={{ marginBottom: "var(--space-4)" }} />
      <Skeleton width="100%" height={90} radius="var(--radius-md)" style={{ marginBottom: "var(--space-4)" }} />
      <SkeletonCard rows={6} />
    </main>
  );
}
