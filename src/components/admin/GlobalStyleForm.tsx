"use client";

import { useRef, useState, useTransition } from "react";
import { resetAppTheme, updateAppTheme } from "@/app/admin/style/actions";
import { DEFAULT_THEME, themeToCssVars, type AppTheme, type HeadingFont } from "@/lib/themeVars";
import styles from "./GlobalStyleForm.module.css";

const FONT_OPTIONS: HeadingFont[] = ["Barlow", "Oswald"];

const COLOR_FIELDS: { key: keyof Omit<AppTheme, "headingFont" | "radius" | "logoUrl">; label: string; helper: string }[] = [
  { key: "ink", label: "Ink", helper: "Headings & body text" },
  { key: "pageBg", label: "Page background", helper: "Behind the sidebar & shell" },
  { key: "surface", label: "Card surface", helper: "Stat cards & table headers" },
  { key: "border", label: "Border", helper: "Card & table hairlines" },
  { key: "accent", label: "Accent", helper: "Highlights, active tabs, key numbers" },
];

// Applies the theme directly to the document root so every part of the
// current page (sidebar included, since it's the same document) updates
// instantly while an admin is still dragging a control — ahead of the
// server action's revalidate landing.
function applyLivePreview(theme: AppTheme) {
  const vars = themeToCssVars(theme);
  for (const [key, value] of Object.entries(vars)) {
    document.documentElement.style.setProperty(key, value);
  }
}

export default function GlobalStyleForm({ initialTheme }: { initialTheme: AppTheme }) {
  const [theme, setTheme] = useState(initialTheme);
  const [isPending, startTransition] = useTransition();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function change(partial: Partial<AppTheme>) {
    const next = { ...theme, ...partial };
    setTheme(next);
    applyLivePreview(next);
    // Colors are dragged/typed quickly (the browser color picker can fire
    // several changes in a row) — debounce the persisted write so each
    // drag doesn't queue a separate server round trip.
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      startTransition(() => {
        updateAppTheme(partial);
      });
    }, 300);
  }

  function reset() {
    setTheme(DEFAULT_THEME);
    applyLivePreview(DEFAULT_THEME);
    startTransition(() => {
      resetAppTheme();
    });
  }

  return (
    <>
      <div className={styles.grid}>
        <div className={styles.panel}>
          <div className={styles.panelTitle}>Colors</div>
          {COLOR_FIELDS.map((field) => (
            <div key={field.key} className={styles.row}>
              <div>
                <div className={styles.rowLabel}>{field.label}</div>
                <div className={styles.rowHelper}>{field.helper}</div>
              </div>
              <input
                type="color"
                value={theme[field.key]}
                onChange={(e) => change({ [field.key]: e.target.value } as Partial<AppTheme>)}
                className={styles.colorInput}
                aria-label={field.label}
              />
            </div>
          ))}
        </div>

        <div className={styles.panel}>
          <div className={styles.panelTitle}>Type &amp; shape</div>
          <div className={styles.fieldBlock}>
            <label htmlFor="heading-font" className={styles.fieldLabel}>
              Heading font
            </label>
            <select
              id="heading-font"
              value={theme.headingFont}
              onChange={(e) => change({ headingFont: e.target.value as HeadingFont })}
              className={styles.select}
            >
              {FONT_OPTIONS.map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            </select>
          </div>
          <div className={styles.fieldBlock}>
            <label htmlFor="radius" className={styles.fieldLabel}>
              <span>Card roundness</span>
              <span className={styles.radiusValue}>{theme.radius}px</span>
            </label>
            <input
              id="radius"
              type="range"
              min={0}
              max={24}
              step={2}
              value={theme.radius}
              onChange={(e) => change({ radius: Number(e.target.value) })}
              className={styles.range}
            />
          </div>
        </div>
        <div className={styles.panel}>
          <div className={styles.panelTitle}>Branding</div>
          <div className={styles.fieldBlock}>
            <label htmlFor="logo-url" className={styles.fieldLabel}>
              Logo URL
            </label>
            <input
              id="logo-url"
              type="text"
              placeholder="https://…"
              value={theme.logoUrl ?? ""}
              onChange={(e) => change({ logoUrl: e.target.value.trim() || null })}
              className={styles.select}
            />
            <div className={styles.rowHelper}>Shown in the sidebar in place of the default mark. Leave blank to use it.</div>
          </div>
        </div>
      </div>

      <div className={styles.resetRow}>
        <button type="button" onClick={reset} className={styles.resetButton} disabled={isPending}>
          Reset to default
        </button>
      </div>

      <div className={styles.previewSection}>
        <div className={styles.previewLabel}>Live preview</div>
        <div className={styles.previewGrid}>
          <div className={styles.previewCard}>
            <div className={styles.previewStatLabel}>Season Score</div>
            <div className={styles.previewStatValue}>1,284</div>
          </div>
          <div className={`${styles.previewCard} ${styles.previewCardCenter}`}>
            <button type="button" className={styles.previewButton}>
              Set Lineup
            </button>
          </div>
          <div className={styles.previewInkCard}>
            <div className={styles.previewInkTile}>T</div>
          </div>
        </div>
      </div>
    </>
  );
}
