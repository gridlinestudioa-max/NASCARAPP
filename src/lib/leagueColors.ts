// Preset swatches a member can pick for how their sidebar shows one of
// their leagues (LeagueMembership.color) — a fixed palette rather than a
// free color input, so every member's sidebar stays legible regardless of
// the current light/dark theme.
export const LEAGUE_COLOR_SWATCHES = [
  "#c0392b", // red
  "#d68910", // orange
  "#b7950b", // gold
  "#1e8449", // green
  "#148f73", // teal
  "#2874a6", // blue
  "#6c3483", // purple
  "#943126", // maroon
];

export function isLeagueColorSwatch(value: unknown): value is string {
  return typeof value === "string" && LEAGUE_COLOR_SWATCHES.includes(value);
}
