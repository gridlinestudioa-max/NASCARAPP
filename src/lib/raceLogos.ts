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

export function getRaceLogo(trackName: string): string | null {
  return RACE_LOGOS[trackName.trim().toLowerCase()] ?? null;
}
