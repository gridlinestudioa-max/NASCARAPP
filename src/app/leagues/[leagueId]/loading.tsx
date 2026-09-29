import { Skeleton, SkeletonCard } from "@/components/ui/Skeleton";

// Deliberately placed here rather than inside (hub)/ — a loading.tsx only
// covers the *children* of the layout it sits beside, not that layout's
// own async body, and (hub)/layout.tsx does its own data fetch
// (getLeagueHubData) before rendering. Sitting one level up means this
// covers both the hub layout's first mount (hero + tabs) and every tab
// page nested under it, so a still-loading league never falls through to
// the home page's own skeleton shape.
export default function LeagueHubLoading() {
  return (
    <main>
      <Skeleton width={200} height={16} radius={4} style={{ marginBottom: "var(--space-4)" }} />
      <Skeleton width="100%" height={140} radius="var(--radius-md)" style={{ marginBottom: "var(--space-4)" }} />
      <Skeleton width={280} height={38} radius="var(--radius-pill)" style={{ margin: "0 auto var(--space-4)" }} />
      <SkeletonCard rows={5} />
    </main>
  );
}
