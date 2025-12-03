import XRegExp from "xregexp";

/**
 * Returns true if `text` contains something that looks like a date.
 * Uses XRegExp to support multiple common numeric and month-name formats.
 */
const MONTH = String.raw`(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)`;

// 2024-11-22 / 2024/11/22 / 2024.11.22
const isoYmd = XRegExp(
  String.raw`\b(?:19|20)\d{2}[-/.](?:0?[1-9]|1[0-2])[-/.](?:0?[1-9]|[12]\d|3[01])\b`
);

// 22/11/2024 / 22-11-24 / 22.11.2024  (DMY)
const dmy = XRegExp(
  String.raw`\b(?:0?[1-9]|[12]\d|3[01])[-/.](?:0?[1-9]|1[0-2])[-/.](?:(?:19|20)?\d{2})\b`
);

// 11/22/2024 / 11-22-24 / 11.22.2024 (MDY)
const mdy = XRegExp(
  String.raw`\b(?:0?[1-9]|1[0-2])[-/.](?:0?[1-9]|[12]\d|3[01])[-/.](?:(?:19|20)?\d{2})\b`
);

// 20241122 (compact yyyymmdd)
const compactYmd = XRegExp(
  String.raw`\b(?:19|20)\d{2}(?:0[1-9]|1[0-2])(?:0[1-9]|[12]\d|3[01])\b`
);

// Jan 5, 2024 / January 5 24 / jan 5th 2024
const monthDayYear = XRegExp(
  String.raw`\b${MONTH}\s+(?:0?[1-9]|[12]\d|3[01])(?:st|nd|rd|th)?(?:,)?\s+(?:(?:19|20)?\d{2})\b`,
  "i"
);

// 5 Jan 2024 / 5th of January, 24
const dayMonthYear = XRegExp(
  String.raw`\b(?:0?[1-9]|[12]\d|3[01])(?:st|nd|rd|th)?\s+(?:of\s+)?${MONTH}(?:,)?\s+(?:(?:19|20)?\d{2})\b`,
  "i"
);

// Jan 2024 / September 1999
const monthYear = XRegExp(String.raw`\b${MONTH}\s+(?:19|20)\d{2}\b`, "i");

// 11/2024 or 11-2024 (numeric month/year)
const numericMonthYear = XRegExp(
  String.raw`\b(?:0?[1-9]|1[0-2])[-/](?:19|20)\d{2}\b`
);

const DATE_RE = XRegExp.union(
  [
    isoYmd,
    dmy,
    mdy,
    compactYmd,
    monthDayYear,
    dayMonthYear,
    monthYear,
    numericMonthYear,
  ],
  "i"
);

export function hasDate(text: string): boolean {
  if (!text) return false;
  return XRegExp.test(text, DATE_RE);
}

/**
 * Extracts all date strings from text and returns them as ISO formatted strings.
 * Returns an empty array if no dates are found or if parsing fails.
 */
export function getDates(text: string): string[] {
  if (!text) return [];
  
  const matches = XRegExp.match(text, DATE_RE, "all");
  if (!matches) return [];

  const dates: string[] = [];
  
  for (const match of matches) {
    const dateStr = typeof match === "string" ? match : match[0];
    const parsed = parseDate(dateStr);
    if (parsed) {
      dates.push(parsed.toISOString().split('T')[0]);
    }
  }
  
  return dates;
}

function parseDate(dateStr: string): Date | null {
  const normalized = dateStr.trim().toLowerCase();
  
  // Try to parse with common formats
  const formats = [
    // ISO formats: 2024-11-22
    /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/,
    // DMY: 22/11/2024
    /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})$/,
    // Compact: 20241122
    /^(\d{4})(\d{2})(\d{2})$/,
  ];
  
  // ISO format
  const isoMatch = formats[0].exec(dateStr);
  if (isoMatch) {
    const [, year, month, day] = isoMatch;
    const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
    if (!isNaN(date.getTime())) return date;
  }
  
  // Compact format
  const compactMatch = formats[2].exec(dateStr);
  if (compactMatch) {
    const [, year, month, day] = compactMatch;
    const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
    if (!isNaN(date.getTime())) return date;
  }
  
  // DMY/MDY format - ambiguous, try MDY first (US format)
  const dmyMatch = formats[1].exec(dateStr);
  if (dmyMatch) {
    let [, p1, p2, p3] = dmyMatch;
    const year = p3.length === 2 ? 2000 + parseInt(p3) : parseInt(p3);
    
    // Try MDY
    let date = new Date(year, parseInt(p1) - 1, parseInt(p2));
    if (!isNaN(date.getTime()) && parseInt(p1) <= 12) return date;
    
    // Try DMY
    date = new Date(year, parseInt(p2) - 1, parseInt(p1));
    if (!isNaN(date.getTime())) return date;
  }
  
  // Month name formats
  const monthNames: Record<string, number> = {
    jan: 0, january: 0,
    feb: 1, february: 1,
    mar: 2, march: 2,
    apr: 3, april: 3,
    may: 4,
    jun: 5, june: 5,
    jul: 6, july: 6,
    aug: 7, august: 7,
    sep: 8, sept: 8, september: 8,
    oct: 9, october: 9,
    nov: 10, november: 10,
    dec: 11, december: 11,
  };
  
  // Month Day Year: Jan 5, 2024
  const mdyTextMatch = /^([a-z]+)\s+(\d{1,2})(?:st|nd|rd|th)?\s*,?\s*(\d{2,4})$/i.exec(normalized);
  if (mdyTextMatch) {
    const [, month, day, year] = mdyTextMatch;
    const monthNum = monthNames[month];
    if (monthNum !== undefined) {
      const fullYear = year.length === 2 ? 2000 + parseInt(year) : parseInt(year);
      const date = new Date(fullYear, monthNum, parseInt(day));
      if (!isNaN(date.getTime())) return date;
    }
  }
  
  // Day Month Year: 5 Jan 2024
  const dmyTextMatch = /^(\d{1,2})(?:st|nd|rd|th)?\s+(?:of\s+)?([a-z]+)\s*,?\s*(\d{2,4})$/i.exec(normalized);
  if (dmyTextMatch) {
    const [, day, month, year] = dmyTextMatch;
    const monthNum = monthNames[month];
    if (monthNum !== undefined) {
      const fullYear = year.length === 2 ? 2000 + parseInt(year) : parseInt(year);
      const date = new Date(fullYear, monthNum, parseInt(day));
      if (!isNaN(date.getTime())) return date;
    }
  }
  
  // Month Year: Jan 2024
  const myMatch = /^([a-z]+)\s+(\d{4})$/i.exec(normalized);
  if (myMatch) {
    const [, month, year] = myMatch;
    const monthNum = monthNames[month];
    if (monthNum !== undefined) {
      const date = new Date(parseInt(year), monthNum, 1);
      if (!isNaN(date.getTime())) return date;
    }
  }
  
  // Numeric Month/Year: 11/2024
  const numMyMatch = /^(\d{1,2})[-/](\d{4})$/.exec(dateStr);
  if (numMyMatch) {
    const [, month, year] = numMyMatch;
    const date = new Date(parseInt(year), parseInt(month) - 1, 1);
    if (!isNaN(date.getTime())) return date;
  }
  
  return null;
}
