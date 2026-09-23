"use client";

import { useEffect, useRef, useState } from "react";
import {
  Chart,
  LineController,
  LineElement,
  PointElement,
  LinearScale,
  CategoryScale,
  Tooltip,
} from "chart.js";
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

export type TrendSeries = { userId: string; name: string; data: number[] };

export default function TrendChart({
  labels,
  series,
  // Flips the y-axis so 1st place plots at the top — for a rank series
  // ("Weekly Placement") where a lower number is better, unlike a points
  // or differential series where higher is better.
  yReversed = false,
}: {
  labels: string[];
  series: TrendSeries[];
  yReversed?: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<Chart | null>(null);
  const [hidden, setHidden] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!canvasRef.current) return;

    const datasets = series.map((s, i) => ({
      label: s.name,
      data: s.data,
      borderColor: SERIES_COLORS[i % SERIES_COLORS.length],
      backgroundColor: SERIES_COLORS[i % SERIES_COLORS.length],
      borderWidth: 2,
      pointRadius: 0,
      pointHoverRadius: 4,
      tension: 0.4,
      cubicInterpolationMode: "monotone" as const,
      hidden: hidden.has(s.userId),
    }));

    const yScale = {
      reverse: yReversed,
      grid: { color: "#e6e4d4" },
      ticks: {
        color: "#9aa1a8",
        stepSize: yReversed ? 1 : undefined,
        precision: yReversed ? 0 : undefined,
      },
    };

    if (chartRef.current) {
      chartRef.current.data = { labels, datasets };
      chartRef.current.options.scales = { ...chartRef.current.options.scales, y: yScale };
      chartRef.current.update();
    } else {
      chartRef.current = new Chart(canvasRef.current, {
        type: "line",
        data: { labels, datasets },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          interaction: { mode: "index", intersect: false },
          plugins: {
            legend: { display: false },
            tooltip: {
              backgroundColor: "#070707",
              borderColor: "#e6e4d4",
              borderWidth: 1,
              titleColor: "#fffef1",
              bodyColor: "#fffef1",
              padding: 10,
            },
          },
          scales: {
            x: { grid: { color: "#e6e4d4" }, ticks: { color: "#9aa1a8", maxRotation: 0, autoSkip: true } },
            y: yScale,
          },
        },
      });
    }
  }, [labels, series, hidden, yReversed]);

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
      <div className={styles.wrap}>
        <canvas ref={canvasRef} />
      </div>
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
