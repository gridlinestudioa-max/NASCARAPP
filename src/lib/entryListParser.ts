// A line is either just a name ("Denny Hamlin") or a car number followed by
// a name, separated by a dash, period, comma, or plain whitespace
// ("5 - Kyle Larson", "5 Kyle Larson", "5. Kyle Larson").
const CAR_NUMBER_LINE = /^(\d{1,3})\s*[-.,]?\s+(.+)$/;

export function parseEntryListText(text: string): { driverName: string; carNumber: number | null }[] {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => {
      const match = line.match(CAR_NUMBER_LINE);
      if (match) {
        return { driverName: match[2].trim(), carNumber: parseInt(match[1], 10) };
      }
      return { driverName: line, carNumber: null };
    });
}
