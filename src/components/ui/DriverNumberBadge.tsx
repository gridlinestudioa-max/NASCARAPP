// A small circular badge for a driver — shows their car number (styled
// like NASCAR's own number circles) when known, falling back to the
// driver's initial when it isn't (no team/number feed is wired up for
// every driver yet — see Driver.number in schema.prisma).
export default function DriverNumberBadge({
  number,
  name,
  className,
}: {
  number: number | null;
  name: string;
  className?: string;
}) {
  return <span className={className}>{number != null ? `#${number}` : name.charAt(0).toUpperCase()}</span>;
}
