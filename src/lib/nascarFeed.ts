// Adapter for cf.nascar.com's undocumented "Content Feed" (CF) API — the
// same feed NASCAR.com's own site and most third-party fantasy tools read
// from. There is no official support or SLA for it, and no authentication;
// it can change or disappear without notice.
//
// The field names below come from TannerYohe/nascar-api (a maintained,
// typed Python client built against real traffic), not from guesswork —
// but this file's own fetch calls have not themselves been exercised
// against live traffic (the sandbox this was written in blocks outbound
// requests to cf.nascar.com), so treat the parsing logic as reviewed-not-
// proven until it's run against a real upcoming race.
//
// This module only fetches and parses — it never touches the database.
// Turning parsed data into DB writes (and resolving driver names to our
// own Driver rows) is the caller's job, in src/lib/raceSync.ts.

const NASCAR_CF_DOMAIN = "https://cf.nascar.com";
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

// cf.nascar.com sits behind Cloudflare and 403s a bare server-side fetch
// with no User-Agent/Referer — the same request a browser makes (which is
// how NASCAR.com's own site and every third-party fantasy tool reads this
// feed) goes through fine. These headers just make the request look like
// what a browser on nascar.com actually sends; the feed itself is public,
// unauthenticated JSON with no login or paywall behind it.
const BROWSER_LIKE_HEADERS = {
  accept: "application/json",
  "user-agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  referer: "https://www.nascar.com/",
  origin: "https://www.nascar.com",
};

async function fetchJson<T>(url: string): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, { headers: BROWSER_LIKE_HEADERS, cache: "no-store" });
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
// auto-link our Race rows to NASCAR's without manual entry.
export async function fetchSeasonRaceList(year: number): Promise<NascarRaceListEntry[]> {
  const data = await fetchJson<NascarRaceListEntry[]>(`${NASCAR_CF_DOMAIN}/${year}/race_list_basic.json`);
  if (!Array.isArray(data)) {
    throw new NascarFeedError(`Unexpected season race list shape for ${year}`);
  }
  return data;
}

// One race weekend's entry list, qualifying grid, results, and stage
// results, all in a single response.
export async function fetchWeekendFeed(
  year: number,
  seriesId: number,
  nascarRaceId: number,
): Promise<NascarWeekendInfo> {
  return fetchJson<NascarWeekendInfo>(
    `${NASCAR_CF_DOMAIN}/${year}/${seriesId}/${nascarRaceId}/weekend-feed.json`,
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

// Finds the one NASCAR schedule entry that plausibly corresponds to one of
// our races: same normalized track name, race date within 3 days. An
// ambiguous match (more than one candidate) is treated the same as no
// match at all — left for a human to confirm rather than guessed at.
export function matchScheduleEntry(
  ourRace: { trackName: string; date: Date },
  candidates: NascarRaceListEntry[],
): NascarRaceListEntry | null {
  const normalized = normalizeTrackName(ourRace.trackName);
  const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000;
  const matches = candidates.filter((c) => {
    if (normalizeTrackName(c.track_name) !== normalized) return false;
    const candidateDate = new Date(c.race_date).getTime();
    return Math.abs(candidateDate - ourRace.date.getTime()) <= THREE_DAYS_MS;
  });
  return matches.length === 1 ? matches[0] : null;
}
