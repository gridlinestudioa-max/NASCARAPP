// Race names synced from NASCAR's own schedule often carry a sponsor
// suffix ("... presented by Progressive", "... Powered by Coca-Cola") that
// only adds length wherever the name is just being listed. This strips it
// for display — the stored Race.trackName itself is left untouched, since
// sync matching (see lib/raceSync.ts, lib/tierRanking.ts) keys off the
// real NASCAR name and admin edit forms need the actual value to save
// correctly.
const SPONSOR_SUFFIX_RE = /\s*\(?\b(?:presented by|powered by|brought to you by)\b.*$/i;

export function displayRaceName(trackName: string): string {
  return trackName.replace(SPONSOR_SUFFIX_RE, "").trimEnd();
}
