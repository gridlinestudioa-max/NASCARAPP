"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Chart,
  LineController,
  LineElement,
  PointElement,
  LinearScale,
  CategoryScale,
  Tooltip,
} from "chart.js";
import RangeSlider from "@/components/ui/RangeSlider";
import styles from "./TrendChart.module.css";

Chart.register(LineController, LineElement, PointElement, LinearScale, CategoryScale, Tooltip);

// Cycled by series index — a small, distinct categorical palette rather
// than one color per specific player, since a league can have any number
// of members.
const SERIES_COLORS = [
  "#c8433a",
  "#2f7d5b",
  "#3a6ea5",
  "#b58a2e",
  "#7a5ea8",
  "#c25a97",
  "#4a4a4a",
  "#1f9e9e",
];

// Canvas can't read CSS custom properties itself (context.font/strokeStyle
// need a resolved string, not "var(--x)"), so every themed color and the
// site's actual font family — the real next/font-generated name behind
// --font-inter, not the literal word "Inter" — are read from the live
// computed style right before each chart (re)build. That's also what
// makes the chart follow light/dark mode instead of the flat hardcoded
// hex values this component used to have.
function readChartTheme() {
  const root = getComputedStyle(document.documentElement);
  const read = (name: string, fallback: string) => root.getPropertyValue(name).trim() || fallback;
  const inter = read("--font-inter", "");
  return {
    font: inter ? `${inter}, ${read("--font-body", "sans-serif")}` : read("--font-body", "sans-serif"),
    grid: read("--border-color", "#e3e3e3"),
    tick: read("--text-secondary", "#7a7a7a"),
    tooltipBg: read("--ink", "#141414"),
    tooltipText: read("--text-on-ink", "#ffffff"),
  };
}

export type TrendSeries = { userId: string; name: string; data: number[] };

export default function TrendChart({
  labels,
  series,
  // Flips the y-axis so 1st place plots at the top — for a rank series
  // ("Weekly Placement") where a lower number is better, unlike a points
  // or differential series where higher is better.
  yReversed = false,
  // Lets a tighter layout (e.g. Stats tab) ask for a shorter chart than
  // the 260px default.
  height = 260,
}: {
  labels: string[];
  series: TrendSeries[];
  yReversed?: boolean;
  height?: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<Chart | null>(null);
  const [hidden, setHidden] = useState<Set<string>>(new Set());

  // [startIndex, endIndex] into `labels`/each series' `data` — the window
  // the slider currently shows. Resets to the full season whenever the
  // number of weeks changes (a new race gets scored, or the user switches
  // to a league with a different schedule length) — the "adjusting state
  // when a prop changes" pattern (a render-time compare against the last
  // seen length), not an effect, per React's own guidance on avoiding the
  // extra render+effect round trip a useEffect-based reset would cost.
  const [range, setRange] = useState<[number, number]>([0, Math.max(0, labels.length - 1)]);
  const [lastLength, setLastLength] = useState(labels.length);
  if (labels.length !== lastLength) {
    setLastLength(labels.length);
    setRange([0, Math.max(0, labels.length - 1)]);
  }

  const [start, end] = range;
  const slicedLabels = useMemo(() => labels.slice(start, end + 1), [labels, start, end]);
  const slicedSeries = useMemo(
    () => series.map((s) => ({ ...s, data: s.data.slice(start, end + 1) })),
    [series, start, end],
  );

  useEffect(() => {
    if (!canvasRef.current) return;
    const ctx = canvasRef.current.getContext("2d");
    if (!ctx) return;
    const theme = readChartTheme();

    const datasets = slicedSeries.map((s, i) => {
      const color = SERIES_COLORS[i % SERIES_COLORS.length];
      return {
        label: s.name,
        data: s.data,
        borderColor: color,
        fill: false,
        borderWidth: 2,
        pointRadius: 0,
        pointHoverRadius: 4,
        pointHoverBackgroundColor: color,
        pointHoverBorderColor: theme.tooltipText,
        pointHoverBorderWidth: 2,
        tension: 0.4,
        cubicInterpolationMode: "monotone" as const,
        hidden: hidden.has(s.userId),
      };
    });

    const yScale = {
      reverse: yReversed,
      border: { display: false },
      grid: { color: theme.grid },
      ticks: {
        color: theme.tick,
        font: { family: theme.font, size: 11 },
        stepSize: yReversed ? 1 : undefined,
        precision: yReversed ? 0 : undefined,
      },
    };
    const xScale = {
      border: { display: false },
      grid: { display: false },
      ticks: { color: theme.tick, font: { family: theme.font, size: 11 }, maxRotation: 0, autoSkip: true },
    };

    if (chartRef.current) {
      chartRef.current.data = { labels: slicedLabels, datasets };
      chartRef.current.options.scales = { x: xScale, y: yScale };
      chartRef.current.update();
    } else {
      chartRef.current = new Chart(ctx, {
        type: "line",
        data: { labels: slicedLabels, datasets },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          // The slider re-slices data on every drag, which would otherwise
          // replay Chart.js's default "grow up from the axis" animation on
          // each step — the graph should just snap to the new window.
          animation: false,
          interaction: { mode: "index", intersect: false },
          plugins: {
            legend: { display: false },
            tooltip: {
              backgroundColor: theme.tooltipBg,
              titleColor: theme.tooltipText,
              bodyColor: theme.tooltipText,
              titleFont: { family: theme.font, weight: 700 },
              bodyFont: { family: theme.font },
              padding: 10,
              cornerRadius: 8,
              displayColors: true,
              boxPadding: 4,
            },
          },
          scales: { x: xScale, y: yScale },
        },
      });
    }
  }, [slicedLabels, slicedSeries, hidden, yReversed, height]);

  useEffect(() => {
    return () => {
      chartRef.current?.destroy();
      chartRef.current = null;
    };
  }, []);

  function toggle(userId: string) {
    setHidden((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  }

  return (
    <div>
      <div className={styles.wrap} style={{ height }}>
        <canvas ref={canvasRef} />
      </div>
      {labels.length > 1 && (
        <div className={styles.sliderWrap}>
          <RangeSlider
            min={0}
            max={labels.length - 1}
            value={range}
            onChange={setRange}
            formatLabel={(i) => labels[i] ?? ""}
            aria-label="Week range"
          />
        </div>
      )}
      <div className={styles.legend}>
        {series.map((s, i) => (
          <button
            key={s.userId}
            type="button"
            className={hidden.has(s.userId) ? `${styles.legendItem} ${styles.legendMuted}` : styles.legendItem}
            onClick={() => toggle(s.userId)}
          >
            <span className={styles.dot} style={{ background: SERIES_COLORS[i % SERIES_COLORS.length] }} />
            {s.name}
          </button>
        ))}
      </div>
    </div>
  );
}
