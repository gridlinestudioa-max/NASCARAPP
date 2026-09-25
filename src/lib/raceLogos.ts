// Maps a Race.trackName to a bundled sponsor-logo asset under
// public/race-logos/. Keyed by exact trackName (case-insensitive, trimmed)
// rather than fuzzy venue matching: several tracks host two differently
// named races a season (Atlanta, Darlington, Daytona, Kansas, Martinsville,
// Talladega, Bristol, Texas, Charlotte), so a venue-keyword match can't
// tell them apart — only the race's own name can. Covers both today's
// seeded placeholder names ("Atlanta 1") and the real NASCAR-synced names
// they get replaced with once a schedule sync runs (see raceSync.ts) —
// a trackName that matches neither falls back to the generic checkered
// flag badge (RaceLogo component) rather than showing nothing.
const RACE_LOGOS: Record<string, string> = {
  "daytona 1": "/race-logos/daytona-500.jpg",
  "daytona 500": "/race-logos/daytona-500.jpg",

  "atlanta 1": "/race-logos/atlanta-spring.png",
  "ambetter health 400": "/race-logos/atlanta-spring.png",
  "ecopark automotive 400": "/race-logos/atlanta-spring.png",

  cota: "/race-logos/cota.png",
  "ecopark automotive grand prix": "/race-logos/cota.png",

  phoenix: "/race-logos/phoenix.png",
  "straight talk wireless 500": "/race-logos/phoenix.png",

  vegas: "/race-logos/las-vegas.png",
  "las vegas": "/race-logos/las-vegas.png",
  "pennzoil 400": "/race-logos/las-vegas.png",

  "darlington 1": "/race-logos/darlington-spring.png",
  "dollar tree 301": "/race-logos/darlington-spring.png",
  "goodyear 400": "/race-logos/darlington-spring.png",

  martinsville: "/race-logos/martinsville-spring.webp",
  "cook out 400": "/race-logos/martinsville-spring.webp",

  bristol: "/race-logos/bristol-spring.jpg",
  "food city 500": "/race-logos/bristol-spring.jpg",

  kansas: "/race-logos/kansas-spring.jpg",
  "adventhealth 400": "/race-logos/kansas-spring.jpg",

  talladega: "/race-logos/talladega-spring.png",
  "jack link's 500": "/race-logos/talladega-spring.png",
  "geico 500": "/race-logos/talladega-spring.png",

  "texas 1": "/race-logos/texas-spring.png",
  texas: "/race-logos/texas-spring.png",

  glen: "/race-logos/watkins-glen.jpg",
  "watkins glen": "/race-logos/watkins-glen.jpg",
  "go bowling at the glen": "/race-logos/watkins-glen.jpg",

  dover: "/race-logos/dover.png",

  charlotte: "/race-logos/charlotte-spring.jpg",
  "coca-cola 600": "/race-logos/charlotte-spring.jpg",

  nashville: "/race-logos/nashville.jpg",
  "ally 400": "/race-logos/nashville.jpg",

  michigan: "/race-logos/michigan.png",
  "firekeepers casino 400": "/race-logos/michigan.png",

  pocono: "/race-logos/pocono.png",
  "great american getaway 400": "/race-logos/pocono.png",

  "san diego": "/race-logos/san-diego.jpg",

  sonoma: "/race-logos/sonoma.png",
  "toyota / save mart 350": "/race-logos/sonoma.png",
  "toyota/save mart 350": "/race-logos/sonoma.png",

  chicago: "/race-logos/chicago.jpg",

  "atlanta 2": "/race-logos/atlanta-summer.png",
  "quaker state 400": "/race-logos/atlanta-summer.png",

  "north wilkesboro": "/race-logos/north-wilkesboro.png",
  "window world 450": "/race-logos/north-wilkesboro.png",

  indianapolis: "/race-logos/indianapolis.png",
  "brickyard 400": "/race-logos/indianapolis.png",

  iowa: "/race-logos/iowa.png",
  "iowa corn 350": "/race-logos/iowa.png",

  richmond: "/race-logos/richmond.png",
  "cook out 400 (richmond)": "/race-logos/richmond.png",

  "daytona 2": "/race-logos/daytona-summer.jpg",
  "coke zero sugar 400": "/race-logos/daytona-summer.jpg",

  "darlington 2": "/race-logos/darlington-fall.jpg",
  "cook out southern 500": "/race-logos/darlington-fall.jpg",
  "southern 500": "/race-logos/darlington-fall.jpg",

  gateway: "/race-logos/gateway.webp",
  "enjoy illinois 300": "/race-logos/gateway.webp",

  "bass pro shops night race": "/race-logos/bristol-fall.png",

  "hollywood casino 400": "/race-logos/kansas-fall.png",

  "south point 400": "/race-logos/south-point-400.png",

  "bank of america 400": "/race-logos/charlotte-fall.png",
  "bank of america roval 400": "/race-logos/charlotte-fall.png",

  "freeway insurance 500": "/race-logos/texas-fall.png",

  "yellawood 500": "/race-logos/talladega-fall.png",

  "xfinity 500": "/race-logos/martinsville-fall.png",

  "nascar cup series championship race": "/race-logos/championship.png",
  "championship race": "/race-logos/championship.png",
};

// Strips whitespace/punctuation so a real NASCAR-synced race name (which
// can carry sponsor-suffix or spacing variations we didn't anticipate when
// this dictionary's keys were written) still matches — e.g. "YellaWood
// 500" vs "Yellawood  500". Never strips words, so two real races still
// can't collide on a shared venue nickname.
function normalizeKey(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

const NORMALIZED_RACE_LOGOS = new Map(
  Object.entries(RACE_LOGOS).map(([key, src]) => [normalizeKey(key), src]),
);

export function getRaceLogo(trackName: string): string | null {
  const trimmed = trackName.trim().toLowerCase();
  if (RACE_LOGOS[trimmed]) return RACE_LOGOS[trimmed];

  const normalized = normalizeKey(trackName);
  if (NORMALIZED_RACE_LOGOS.has(normalized)) return NORMALIZED_RACE_LOGOS.get(normalized)!;

  // Last resort: a synced name that embeds one of our known names as a
  // substring (e.g. a sponsor-suffixed or venue-suffixed variant) — only
  // matches keys long enough (8+ normalized chars) to make a false
  // positive implausible.
  for (const [key, src] of NORMALIZED_RACE_LOGOS) {
    if (key.length >= 8 && normalized.includes(key)) return src;
  }
  return null;
}

// The bundled logo assets, for an admin <select> (see
// /admin/season-setup's race schedule editor) that lets a race's logo be
// pinned explicitly instead of auto-matched by trackName — useful for a
// next-year race whose real trackName isn't known/synced yet. Deduped by
// asset path (several trackName keys above share one logo) and labeled
// from the filename.
export const RACE_LOGO_OPTIONS: { value: string; label: string }[] = [...new Set(Object.values(RACE_LOGOS))]
  .map((src) => ({
    value: src,
    label: src
      .replace(/^\/race-logos\//, "")
      .replace(/\.[a-z0-9]+$/i, "")
      .split("-")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" "),
  }))
  .sort((a, b) => a.label.localeCompare(b.label));
