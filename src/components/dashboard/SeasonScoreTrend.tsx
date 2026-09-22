import styles from "./SeasonScoreTrend.module.css";

// Pure presentational SVG line chart — no interactivity, so no chart.js /
// client component needed. Mirrors the design's raw polyline approach:
// your cumulative score (solid) vs the league's average cumulative score
// (dashed), dots on your line only.
const WIDTH = 560;
const HEIGHT = 160;
const PAD = 10;

function toPoints(values: number[], min: number, max: number) {
  const span = max - min || 1;
  return values.map((v, i) => {
    const x = values.length > 1 ? PAD + (i * (WIDTH - PAD * 2)) / (values.length - 1) : WIDTH / 2;
    const y = HEIGHT - PAD - ((v - min) / span) * (HEIGHT - PAD * 2);
    return { x: Math.round(x), y: Math.round(y) };
  });
}

// A full season is ~36 races — rendering a dot and an axis label for every
// one crowds the chart into an unreadable smear. Thin both down to an
// evenly spaced subset (always keeping the first and last race) once
// there are more than this many.
const MAX_MARKS = 10;

function thinnedIndices(count: number): number[] {
  if (count <= MAX_MARKS) return Array.from({ length: count }, (_, i) => i);
  const step = (count - 1) / (MAX_MARKS - 1);
  const indices = new Set<number>();
  for (let i = 0; i < MAX_MARKS; i++) indices.add(Math.round(i * step));
  return [...indices].sort((a, b) => a - b);
}

export default function SeasonScoreTrend({
  labels,
  mine,
  average,
}: {
  labels: string[];
  mine: number[];
  average: number[];
}) {
  if (mine.length === 0) {
    return <p className={styles.empty}>No scored races yet this season.</p>;
  }

  const all = [...mine, ...average];
  const min = Math.min(...all);
  const max = Math.max(...all);
  const minePoints = toPoints(mine, min, max);
  const avgPoints = toPoints(average, min, max);
  const marks = thinnedIndices(mine.length);

  return (
    <div>
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} width="100%" height={HEIGHT} className={styles.svg}>
        <polyline
          points={avgPoints.map((p) => `${p.x},${p.y}`).join(" ")}
          fill="none"
          strokeWidth={2}
          strokeDasharray="4 4"
          className={styles.avgLine}
        />
        <polyline
          points={minePoints.map((p) => `${p.x},${p.y}`).join(" ")}
          fill="none"
          strokeWidth={2.5}
          className={styles.myLine}
        />
        {marks.map((i) => (
          <circle key={i} cx={minePoints[i].x} cy={minePoints[i].y} r={4} strokeWidth={2.5} className={styles.dot} />
        ))}
      </svg>
      <div className={styles.axisLabels}>
        {marks.map((i) => (
          <span key={i}>{labels[i]}</span>
        ))}
      </div>
    </div>
  );
}
