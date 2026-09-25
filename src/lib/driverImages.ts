// Maps a Driver.name to a bundled headshot asset under public/driver-photos/
// — same "static lookup keyed by name" pattern as raceLogos.ts and
// trackCities.ts, rather than a Driver.imageUrl DB column, since the
// mapping is entirely determined by the (already-unique) driver name and
// this avoids a migration + production backfill for what's just an asset
// path. A name with no bundled photo (part-time/substitute drivers we
// don't have art for yet) falls back to null — the driver stats modal
// keeps its placeholder in that case.
const DRIVER_IMAGES: Record<string, string> = {
  "ross chastain": "/driver-photos/ross-chastain.png",
  "austin cindric": "/driver-photos/austin-cindric.png",
  "austin dillon": "/driver-photos/austin-dillon.png",
  "noah gragson": "/driver-photos/noah-gragson.png",
  "kyle larson": "/driver-photos/kyle-larson.png",
  "brad keselowski": "/driver-photos/brad-keselowski.png",
  "daniel suarez": "/driver-photos/daniel-suarez.png",
  "chase elliott": "/driver-photos/chase-elliott.png",
  "ty dillon": "/driver-photos/ty-dillon.png",
  "denny hamlin": "/driver-photos/denny-hamlin.png",
  "ryan blaney": "/driver-photos/ryan-blaney.png",
  "aj allmendinger": "/driver-photos/aj-allmendinger.png",
  "chris buescher": "/driver-photos/chris-buescher.png",
  "chase briscoe": "/driver-photos/chase-briscoe.png",
  "christopher bell": "/driver-photos/christopher-bell.png",
  "josh berry": "/driver-photos/josh-berry.png",
  "joey logano": "/driver-photos/joey-logano.png",
  "bubba wallace": "/driver-photos/bubba-wallace.png",
  "william byron": "/driver-photos/william-byron.png",
  "todd gilliland": "/driver-photos/todd-gilliland.png",
  "riley herbst": "/driver-photos/riley-herbst.png",
  "zane smith": "/driver-photos/zane-smith.png",
  "cole custer": "/driver-photos/cole-custer.png",
  "john hunter nemechek": "/driver-photos/john-hunter-nemechek.png",
  "erik jones": "/driver-photos/erik-jones.png",
  "tyler reddick": "/driver-photos/tyler-reddick.png",
  "ricky stenhouse jr.": "/driver-photos/ricky-stenhouse-jr.png",
  "alex bowman": "/driver-photos/alex-bowman.png",
  "cody ware": "/driver-photos/cody-ware.png",
  "ty gibbs": "/driver-photos/ty-gibbs.png",
  "ryan preece": "/driver-photos/ryan-preece.png",
  "michael mcdowell": "/driver-photos/michael-mcdowell.png",
  "carson hocevar": "/driver-photos/carson-hocevar.png",
  "connor zilisch": "/driver-photos/connor-zilisch.png",
  "shane van gisbergen": "/driver-photos/shane-van-gisbergen.png",
};

// NFD-normalizes and drops suffixes like "Jr."/"Sr."/trailing periods so
// "Daniel Suárez" and "Ricky Stenhouse Jr." key the same way the plain-
// ASCII map above is written.
function normalizeName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

const NORMALIZED_DRIVER_IMAGES = new Map(
  Object.entries(DRIVER_IMAGES).map(([key, src]) => [normalizeName(key), src]),
);

export function getDriverImage(driverName: string): string | null {
  const normalized = normalizeName(driverName);
  if (NORMALIZED_DRIVER_IMAGES.has(normalized)) return NORMALIZED_DRIVER_IMAGES.get(normalized)!;

  // "Ricky Stenhouse Jr." vs a plain "Ricky Stenhouse" reference elsewhere.
  const withoutSuffix = normalized.replace(/\s+(jr|sr)\.?$/, "");
  if (NORMALIZED_DRIVER_IMAGES.has(withoutSuffix)) return NORMALIZED_DRIVER_IMAGES.get(withoutSuffix)!;

  return null;
}
