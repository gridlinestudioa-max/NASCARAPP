// Adapter for cf.nascar.com's undocumented "Content Feed" (CF) API — the
// same feed NASCAR.com's own site and most third-party fantasy tools read
// from. There is no official support or SLA for it, and no authentication;
// it can change or disappear without notice.
//
// The URL paths and field names below are cross-checked directly against
// TannerYohe/nascar-api (a maintained, typed Python client built against
// real traffic) — cloned and read line-by-line, not just skimmed from its
// README. An earlier version of this file guessed at the historic paths
// without the "/cacher" prefix that client actually uses and got a 403
// from production as a result; that 403 had nothing to do with bot
// detection (the reference client sends no special headers at all, just
// plain `requests.get()`) — it was simply the wrong URL.
//
// This module only fetches and parses — it never touches the database.
// Turning parsed data into DB writes (and resolving driver names to our
// own Driver rows) is the caller's job, in src/lib/raceSync.ts.

const NASCAR_CF_DOMAIN = "https://cf.nascar.com";
const NASCAR_CF_CACHER_DOMAIN = `${NASCAR_CF_DOMAIN}/cacher`;
export const CUP_SERIES_ID = 1;

// ---------- Raw wire shapes (cf.nascar.com's own field names) ----------

export type NascarRaceListEntry = {
  race_id: number;
  series_id: number;
  race_season: number;
  race_name: string;
  track_name: string;
  race_date: string;
  qualifying_date: string | null;
  number_of_cars_in_field: number | null;
  stage_1_laps: number | null;
  stage_2_laps: number | null;
};

type NascarWeekendResult = {
  driver_id: number;
  driver_fullname: string;
  car_number: number | null;
  car_make: string | null;
  team_name: string | null;
  starting_position: number | null;
  finishing_position: number | null;
  finishing_status: string | null;
  laps_led: number | null;
};

type NascarStageResultRow = {
  driver_id: number;
  driver_fullname: string;
  finishing_position: number;
  stage_points: number;
};

type NascarStageResult = {
  stage_number: number;
  results: NascarStageResultRow[];
};

type NascarWeekendRaceInfo = {
  race_id: number;
  track_name: string;
  number_of_cars_in_field: number | null;
  stage_1_laps: number | null;
  stage_2_laps: number | null;
  qualifying_date: string | null;
  results: NascarWeekendResult[];
  stage_results: NascarStageResult[];
};

type NascarWeekendInfo = {
  race_id: number;
  weekend_race: NascarWeekendRaceInfo[];
};

// ---------- Fetching ----------

class NascarFeedError extends Error {}

async function fetchJson<T>(url: string): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, { headers: { accept: "application/json" }, cache: "no-store" });
  } catch (cause) {
    throw new NascarFeedError(`Could not reach the NASCAR feed (${url}): ${(cause as Error).message}`);
  }
  if (!res.ok) {
    throw new NascarFeedError(`NASCAR feed returned ${res.status} ${res.statusText} for ${url}`);
  }
  try {
    return (await res.json()) as T;
  } catch (cause) {
    throw new NascarFeedError(`NASCAR feed returned invalid JSON (${url}): ${(cause as Error).message}`);
  }
}

// The full season's schedule, with each race's own numeric id — used to
// auto-link our Race rows to NASCAR's without manual entry. The response
// is an object keyed by "series_1"/"series_2"/"series_3" (Cup/Xfinity/
// Truck), each holding that series' races — not a flat array — so every
// series gets flattened into one list here; each race already carries its
// own series_id for downstream filtering.
export async function fetchSeasonRaceList(year: number): Promise<NascarRaceListEntry[]> {
  const data = await fetchJson<Record<string, NascarRaceListEntry[]>>(
    `${NASCAR_CF_CACHER_DOMAIN}/${year}/race_list_basic.json`,
  );
  if (data == null || typeof data !== "object" || Array.isArray(data)) {
    throw new NascarFeedError(`Unexpected season race list shape for ${year}`);
  }
  return Object.values(data).flat();
}

// One race weekend's entry list, qualifying grid, results, and stage
// results, all in a single response.
export async function fetchWeekendFeed(
  year: number,
  seriesId: number,
  nascarRaceId: number,
): Promise<NascarWeekendInfo> {
  return fetchJson<NascarWeekendInfo>(
    `${NASCAR_CF_CACHER_DOMAIN}/${year}/${seriesId}/${nascarRaceId}/weekend-feed.json`,
  );
}

export type NascarPointsEntry = {
  driver_id: number;
  first_name: string;
  last_name: string;
  car_number: number | null;
  points: number;
  points_position: number;
  wins: number;
  top_5: number;
  top_10: number;
};

// Current season points standings, as of the most recently completed
// points race. Fetched under the UPCOMING race's id — this assumes the
// feed reflects "latest standings" regardless of which race id it's
// requested under, which matches how the endpoint is used elsewhere but,
// like the rest of this adapter, hasn't been confirmed against live
// traffic from this environment.
export async function fetchLivePoints(seriesId: number, nascarRaceId: number): Promise<NascarPointsEntry[]> {
  const data = await fetchJson<NascarPointsEntry[]>(
    `${NASCAR_CF_DOMAIN}/live/feeds/series_${seriesId}/${nascarRaceId}/live_points.json`,
  );
  if (!Array.isArray(data)) {
    throw new NascarFeedError(`Unexpected points feed shape for race ${nascarRaceId}`);
  }
  return data;
}

// ---------- Parsing (pure — no I/O, easy to test against a fixture) ----------

export type ParsedEntry = {
  driverName: string;
  carNumber: number | null;
  teamName: string | null;
  manufacturer: string | null;
};
export type ParsedQualifyingPosition = { driverName: string; position: number };
export type ParsedFinishResult = { driverName: string; position: number; dnf: boolean; lapsLed: number | null };
export type ParsedStageResult = { stageNumber: number; driverName: string; position: number };

export type ParsedWeekendData = {
  entries: ParsedEntry[];
  qualifying: ParsedQualifyingPosition[];
  results: ParsedFinishResult[];
  stageResults: ParsedStageResult[];
  fieldSize: number | null;
  stage1Laps: number | null;
  stage2Laps: number | null;
  qualifyingAt: Date | null;
};

// finishing_status values seen in the wild include things like "Running",
// "Accident", "Engine", "Suspension" — anything other than actually
// finishing under power counts as a DNF. Unrecognized/missing statuses
// default to not-DNF rather than penalizing a driver for a field we
// couldn't read.
const RUNNING_STATUSES = new Set(["running"]);

function isDnf(finishingStatus: string | null | undefined): boolean {
  if (!finishingStatus) return false;
  return !RUNNING_STATUSES.has(finishingStatus.trim().toLowerCase());
}

export function parseWeekendData(weekend: NascarWeekendInfo): ParsedWeekendData | null {
  const race = weekend.weekend_race?.[0];
  if (!race || !Array.isArray(race.results)) return null;

  const entries: ParsedEntry[] = [];
  const qualifying: ParsedQualifyingPosition[] = [];
  const results: ParsedFinishResult[] = [];
  const seenDriverNames = new Set<string>();

  for (const r of race.results) {
    const driverName = r.driver_fullname?.trim();
    if (!driverName) continue;

    if (!seenDriverNames.has(driverName)) {
      seenDriverNames.add(driverName);
      entries.push({
        driverName,
        carNumber: typeof r.car_number === "number" ? r.car_number : null,
        teamName: r.team_name?.trim() || null,
        manufacturer: r.car_make?.trim() || null,
      });
    }
    if (typeof r.starting_position === "number" && r.starting_position >= 1) {
      qualifying.push({ driverName, position: r.starting_position });
    }
    if (typeof r.finishing_position === "number" && r.finishing_position >= 1) {
      results.push({
        driverName,
        position: r.finishing_position,
        dnf: isDnf(r.finishing_status),
        lapsLed: typeof r.laps_led === "number" ? r.laps_led : null,
      });
    }
  }

  const stageResults: ParsedStageResult[] = [];
  for (const stage of race.stage_results ?? []) {
    for (const r of stage.results ?? []) {
      const driverName = r.driver_fullname?.trim();
      if (!driverName) continue;
      if (typeof r.finishing_position === "number" && r.finishing_position >= 1 && r.finishing_position <= 10) {
        stageResults.push({ stageNumber: stage.stage_number, driverName, position: r.finishing_position });
      }
    }
  }

  return {
    entries,
    qualifying,
    results,
    stageResults,
    fieldSize: race.number_of_cars_in_field ?? null,
    stage1Laps: race.stage_1_laps ?? null,
    stage2Laps: race.stage_2_laps ?? null,
    qualifyingAt: race.qualifying_date ? new Date(race.qualifying_date) : null,
  };
}

// ---------- Schedule matching ----------

export function normalizeTrackName(name: string): string {
  return name
    .toLowerCase()
    .replace(/\b(international|motor|raceway|speedway|superspeedway|track|complex)\b/g, "")
    .replace(/[^a-z0-9]+/g, "")
    .trim();
}

const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000;

function withinDateWindow(candidate: NascarRaceListEntry, ourDate: Date): boolean {
  const candidateDate = new Date(candidate.race_date).getTime();
  return Math.abs(candidateDate - ourDate.getTime()) <= THREE_DAYS_MS;
}

// The strict half of matchScheduleEntry, split out because
// syncSeasonScheduleWithNascarFeed's positional-offset inference needs
// this specific signal on its own: a name match is high-precision (a
// coincidence would need both the right name AND the right date window),
// unlike the date-only fallback below, which two same-cadence weekly
// schedules (even a totally wrong placeholder one) can collide on by pure
// chance. Our trackName field is displayed (and, since the season-schedule
// sync, kept in sync) as NASCAR's own race_name ("Bass Pro Shops Night
// Race"), but some races are still seeded under a shorthand nickname
// ("Vegas") or haven't been through a sync yet, so this also tries the
// venue's track_name. More than one candidate matching is treated the
// same as none at all — ambiguous, left for a human rather than guessed.
export function matchByNameAndDate(
  ourRace: { trackName: string; date: Date },
  candidates: NascarRaceListEntry[],
): NascarRaceListEntry | null {
  const normalized = normalizeTrackName(ourRace.trackName);
  const matches = candidates.filter(
    (c) =>
      (normalizeTrackName(c.race_name) === normalized || normalizeTrackName(c.track_name) === normalized) &&
      withinDateWindow(c, ourRace.date),
  );
  return matches.length === 1 ? matches[0] : null;
}

// Finds the one NASCAR schedule entry that plausibly corresponds to one of
// our races: a strict name+date match first (see matchByNameAndDate),
// falling back to date alone within the same 3-day window when no name
// matched — `candidates` is always pre-filtered to one series (Cup) by the
// caller, and that series runs at most one points race per weekend, so
// "the one Cup race within 3 days of ours" is usually unambiguous even
// without the name lining up. More than one candidate is treated the same
// as no match either way.
export function matchScheduleEntry(
  ourRace: { trackName: string; date: Date },
  candidates: NascarRaceListEntry[],
): NascarRaceListEntry | null {
  const byNameAndDate = matchByNameAndDate(ourRace, candidates);
  if (byNameAndDate) return byNameAndDate;

  const byDateOnly = candidates.filter((c) => withinDateWindow(c, ourRace.date));
  return byDateOnly.length === 1 ? byDateOnly[0] : null;
}
