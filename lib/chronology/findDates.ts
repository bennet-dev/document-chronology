import XRegExp from "xregexp";
import type {
  ExtractedDate,
  DateClassification,
  PagePosition,
} from "@/lib/types/chronology";

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

// Heuristic patterns for classifying dates by context
const DOS_PATTERNS = [
  /date\s+of\s+service/i,
  /\bdos\b[:\s]/i,
  /visit\s+date/i,
  /service\s+date/i,
  /encounter\s+date/i,
  /admission\s+date/i,
  /procedure\s+date/i,
  /exam\s+date/i,
  /treatment\s+date/i,
];

const DOB_PATTERNS = [
  /date\s+of\s+birth/i,
  /\bdob\b[:\s]/i,
  /birth\s*date/i,
  /\bborn\b[:\s]/i,
  /patient.*born/i,
];

const FAX_PATTERNS = [/\bfax\b/i, /transmitted/i, /\bsent\b[:\s]/i, /received/i];

/**
 * Classifies a date based on surrounding context.
 */
function classifyByContext(
  before: string,
  after: string
): { classification: DateClassification; confidence: number } {
  const context = before + " " + after;

  // Check for Date of Service indicators (highest priority)
  for (const pattern of DOS_PATTERNS) {
    if (pattern.test(before)) {
      return { classification: "date_of_service", confidence: 0.9 };
    }
  }

  // Check for DOB indicators
  for (const pattern of DOB_PATTERNS) {
    if (pattern.test(before)) {
      return { classification: "dob", confidence: 0.95 };
    }
  }

  // Check for fax/transmission indicators
  for (const pattern of FAX_PATTERNS) {
    if (pattern.test(context)) {
      return { classification: "fax", confidence: 0.8 };
    }
  }

  // If DOS pattern appears after the date, still likely DOS
  for (const pattern of DOS_PATTERNS) {
    if (pattern.test(after)) {
      return { classification: "date_of_service", confidence: 0.7 };
    }
  }

  return { classification: "unknown", confidence: 0.0 };
}

/**
 * Determines position on page based on character offset.
 */
function getPosition(offset: number, textLength: number): PagePosition {
  const ratio = offset / textLength;
  if (ratio < 0.2) return "top";
  if (ratio > 0.8) return "bottom";
  return "middle";
}

/**
 * Extracts all dates from text with surrounding context and classification.
 * This is the enhanced version used for medical records processing.
 */
export function getDatesWithContext(text: string): ExtractedDate[] {
  if (!text) return [];

  const results: ExtractedDate[] = [];
  const globalRe = XRegExp(DATE_RE.source, "gi");

  let match: RegExpExecArray | null;
  while ((match = globalRe.exec(text)) !== null) {
    const raw = match[0];
    const offset = match.index;

    // Extract context (50 chars before and after)
    const beforeStart = Math.max(0, offset - 50);
    const afterEnd = Math.min(text.length, offset + raw.length + 50);
    const before = text.slice(beforeStart, offset).trim();
    const after = text.slice(offset + raw.length, afterEnd).trim();

    // Parse to ISO format
    const parsed = parseDate(raw);
    if (!parsed) continue;

    const iso = parsed.toISOString().split("T")[0];
    const position = getPosition(offset, text.length);
    const { classification, confidence } = classifyByContext(before, after);

    results.push({
      raw,
      iso,
      context: { before, after },
      position,
      offset,
      classification,
      confidence,
    });
  }

  return results;
}

/**
 * Determines the most likely date of service from extracted dates.
 * Returns the date and whether it was confidently determined.
 */
export function selectDateOfService(
  dates: ExtractedDate[]
): { date: string; confident: boolean } | null {
  if (dates.length === 0) return null;

  // First, look for high-confidence DOS classification
  const confidentDOS = dates.find(
    (d) => d.classification === "date_of_service" && d.confidence >= 0.8
  );
  if (confidentDOS) {
    return { date: confidentDOS.iso, confident: true };
  }

  // Filter out DOB and fax dates
  const candidates = dates.filter(
    (d) => d.classification !== "dob" && d.classification !== "fax"
  );

  if (candidates.length === 0) return null;

  // Prefer dates at top of page (likely header dates)
  const topDates = candidates.filter((d) => d.position === "top");
  if (topDates.length === 1) {
    return { date: topDates[0].iso, confident: false };
  }

  // If multiple candidates remain, we need LLM help
  if (candidates.length === 1) {
    return { date: candidates[0].iso, confident: false };
  }

  // Multiple ambiguous dates - return first but mark as not confident
  return { date: candidates[0].iso, confident: false };
}
