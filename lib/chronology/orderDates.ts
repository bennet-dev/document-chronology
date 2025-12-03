import { parse, isValid } from "date-fns";

/**
 * Attempts to parse a date string using common formats.
 * Returns a Date object if successful, null otherwise.
 */
function parseDate(dateStr: string): Date | null {
  const formats = [
    // ISO formats
    "yyyy-MM-dd",
    "yyyy/MM/dd",
    "yyyy.MM.dd",
    // DMY formats
    "dd-MM-yyyy",
    "dd/MM/yyyy",
    "dd.MM.yyyy",
    "dd-MM-yy",
    "dd/MM/yy",
    "dd.MM.yy",
    // MDY formats
    "MM-dd-yyyy",
    "MM/dd/yyyy",
    "MM.dd.yyyy",
    "MM-dd-yy",
    "MM/dd/yy",
    "MM.dd.yy",
    // Compact
    "yyyyMMdd",
    // Month name formats
    "MMM d, yyyy",
    "MMM d yyyy",
    "MMMM d, yyyy",
    "MMMM d yyyy",
    "d MMM yyyy",
    "d MMMM yyyy",
    "MMM yyyy",
    "MMMM yyyy",
    // Numeric month/year
    "MM/yyyy",
    "MM-yyyy",
  ];

  for (const format of formats) {
    const parsed = parse(dateStr.trim(), format, new Date());
    if (isValid(parsed)) {
      return parsed;
    }
  }

  return null;
}

/**
 * Orders an array of date strings in chronological order.
 * Invalid dates are placed at the end in their original order.
 */
export function orderDates(dates: string[]): string[] {
  const parsed = dates.map((dateStr) => ({
    original: dateStr,
    date: parseDate(dateStr),
  }));

  const valid = parsed.filter((item) => item.date !== null);
  const invalid = parsed.filter((item) => item.date === null);

  valid.sort((a, b) => a.date!.getTime() - b.date!.getTime());

  return [...valid.map((item) => item.original), ...invalid.map((item) => item.original)];
}
