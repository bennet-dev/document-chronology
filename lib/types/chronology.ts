/** Position hint for where a date appeared on the page */
export type PagePosition = "top" | "middle" | "bottom";

/** Classification of date purpose in medical records */
export type DateClassification =
  | "date_of_service" // The primary date this document refers to
  | "dob" // Patient DOB - should be ignored for chronology
  | "referenced" // A date mentioned in the content (e.g., "since 2020")
  | "fax" // Fax header dates
  | "unknown"; // Needs LLM classification

/** How the date of service was determined */
export type DateSource = "heuristic" | "llm" | "inherited" | "none";

/** A date found in the document with context */
export interface ExtractedDate {
  /** The original matched string (e.g., "01/15/2024") */
  raw: string;
  /** Normalized ISO date string (e.g., "2024-01-15") */
  iso: string;
  /** Text before and after the date (for context) */
  context: {
    before: string; // ~50 chars before
    after: string; // ~50 chars after
  };
  /** Approximate position on page */
  position: PagePosition;
  /** Character offset in the page text */
  offset: number;
  /** Classification based on context keywords */
  classification: DateClassification;
  /** Confidence score for classification (0-1) */
  confidence: number;
}

/** Enhanced page data with date extraction */
export interface PageResult {
  pageNumber: number;
  text: string;
  extractedDates: ExtractedDate[];
  /** The determined date of service for this page */
  dateOfService: string | null;
  /** How the date of service was determined */
  dateSource: DateSource;
  /** If inherited, from which page */
  inheritedFrom?: number;
  /** Detected document type if identifiable */
  documentType?: string;
}

/** A cluster of pages sharing the same date of service */
export interface PageCluster {
  id: string;
  dateOfService: string;
  /** Page numbers in this cluster */
  pages: number[];
  /** First page that established the date */
  primaryPage: number;
  documentType?: string;
}

/** Complete chronology result after processing */
export interface ChronologyResult {
  pages: PageResult[];
  clusters: PageCluster[];
  /** Pages that couldn't be assigned to any date */
  undatedPages: number[];
  /** Processing statistics */
  stats: {
    totalPages: number;
    pagesWithDates: number;
    pagesWithDOS: number;
    pagesInherited: number;
    llmClassified: number;
  };
}

/** Processing phase for UI progress */
export type ProcessingPhase =
  | "idle"
  | "ocr"
  | "extracting"
  | "classifying"
  | "clustering"
  | "done"
  | "error";

/** Processing status for UI */
export interface ProcessingStatus {
  phase: ProcessingPhase;
  progress: number; // 0-100
  message?: string;
  error?: string;
}
