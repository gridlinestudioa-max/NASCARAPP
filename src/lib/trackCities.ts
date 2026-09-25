// Maps a race's venue (or, failing that, its trackName) to the city/state
// the speedway physically sits in. Unlike raceLogos.ts this is keyed per
// VENUE rather than per sponsor race name — a track's location doesn't
// change when its race gets a new title sponsor — so venue nicknames that
// share a logo entry (e.g. "atlanta 1"/"atlanta 2") only need one key here.
const TRACK_CITIES: Record<string, string> = {
  daytona: "Daytona Beach, FL",

  atlanta: "Hampton, GA",

  cota: "Austin, TX",
  "circuit of the americas": "Austin, TX",

  phoenix: "Avondale, AZ",

  vegas: "Las Vegas, NV",
  "las vegas": "Las Vegas, NV",
  "south point 400": "Las Vegas, NV",

  darlington: "Darlington, SC",

  martinsville: "Martinsville, VA",

  bristol: "Bristol, TN",

  kansas: "Kansas City, KS",

  talladega: "Talladega, AL",

  texas: "Fort Worth, TX",
  "autotrader 400": "Fort Worth, TX",

  glen: "Watkins Glen, NY",
  "watkins glen": "Watkins Glen, NY",

  dover: "Dover, DE",
  "wurth 400": "Dover, DE",

  charlotte: "Concord, NC",

  nashville: "Lebanon, TN",

  michigan: "Brooklyn, MI",

  pocono: "Long Pond, PA",

  "san diego": "San Diego, CA",

  sonoma: "Sonoma, CA",

  chicago: "Chicago, IL",

  "north wilkesboro": "North Wilkesboro, NC",
  "all-star race": "North Wilkesboro, NC",
  "nascar all-star race": "North Wilkesboro, NC",

  indianapolis: "Speedway, IN",
  "cracker barrel 400": "Speedway, IN",

  iowa: "Newton, IA",

  richmond: "Richmond, VA",

  gateway: "Madison, IL",
};

// NFD-normalizes first so an accented official name (e.g. "Würth 400")
// matches the plain-ASCII key above instead of losing the "u" entirely.
function normalizeKey(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

const NORMALIZED_TRACK_CITIES = new Map(
  Object.entries(TRACK_CITIES).map(([key, city]) => [normalizeKey(key), city]),
);

// Checks venueName first (the physical track, once synced) and falls back
// to trackName (the race's own name, which often embeds a venue nickname
// even before a sync captures venueName) — same match strategy as
// getRaceLogo: exact, then normalized, then a long-enough substring.
export function getTrackCity(trackName: string, venueName?: string | null): string | null {
  for (const candidate of [venueName, trackName]) {
    if (!candidate) continue;
    const trimmed = candidate.trim().toLowerCase();
    if (TRACK_CITIES[trimmed]) return TRACK_CITIES[trimmed];

    const normalized = normalizeKey(candidate);
    if (NORMALIZED_TRACK_CITIES.has(normalized)) return NORMALIZED_TRACK_CITIES.get(normalized)!;

    for (const [key, city] of NORMALIZED_TRACK_CITIES) {
      if (key.length >= 5 && normalized.includes(key)) return city;
    }
  }
  return null;
}
