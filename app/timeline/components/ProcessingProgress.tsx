"use client";

import type { ProcessingStatus } from "@/lib/types/chronology";

interface ProcessingProgressProps {
  status: ProcessingStatus;
}

const phaseLabels: Record<string, string> = {
  idle: "Ready",
  ocr: "Running OCR...",
  extracting: "Extracting dates...",
  classifying: "Classifying dates with AI...",
  clustering: "Building timeline...",
  done: "Complete",
  error: "Error",
};

const phaseDescriptions: Record<string, string> = {
  idle: "Select a document to begin processing",
  ocr: "Extracting text from PDF pages using Google Vision API",
  extracting: "Finding and analyzing dates in the document text",
  classifying: "Using AI to identify dates of service for ambiguous pages",
  clustering: "Grouping pages by date and building the chronological timeline",
  done: "Processing complete! View your timeline below.",
  error: "An error occurred during processing",
};

export function ProcessingProgress({ status }: ProcessingProgressProps) {
  const isProcessing = !["idle", "done", "error"].includes(status.phase);

  return (
    <div className="bg-white dark:bg-zinc-800 rounded-xl border border-zinc-200 dark:border-zinc-700 p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
          {phaseLabels[status.phase]}
        </h3>
        {isProcessing && (
          <div className="animate-spin h-5 w-5 border-2 border-blue-500 border-t-transparent rounded-full" />
        )}
        {status.phase === "done" && (
          <svg
            className="w-6 h-6 text-green-500"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M5 13l4 4L19 7"
            />
          </svg>
        )}
        {status.phase === "error" && (
          <svg
            className="w-6 h-6 text-red-500"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        )}
      </div>

      <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-4">
        {status.message || phaseDescriptions[status.phase]}
      </p>

      {/* Progress bar */}
      <div className="h-2 bg-zinc-200 dark:bg-zinc-700 rounded-full overflow-hidden">
        <div
          className={`h-full transition-all duration-500 ease-out ${
            status.phase === "error"
              ? "bg-red-500"
              : status.phase === "done"
              ? "bg-green-500"
              : "bg-blue-500"
          }`}
          style={{ width: `${status.progress}%` }}
        />
      </div>

      {/* Phase indicators */}
      <div className="flex justify-between mt-4 text-xs text-zinc-500 dark:text-zinc-400">
        <span
          className={
            ["ocr", "extracting", "classifying", "clustering", "done"].includes(
              status.phase
            )
              ? "text-blue-500"
              : ""
          }
        >
          OCR
        </span>
        <span
          className={
            ["extracting", "classifying", "clustering", "done"].includes(
              status.phase
            )
              ? "text-blue-500"
              : ""
          }
        >
          Extract
        </span>
        <span
          className={
            ["classifying", "clustering", "done"].includes(status.phase)
              ? "text-blue-500"
              : ""
          }
        >
          Classify
        </span>
        <span
          className={
            ["clustering", "done"].includes(status.phase) ? "text-blue-500" : ""
          }
        >
          Cluster
        </span>
        <span className={status.phase === "done" ? "text-green-500" : ""}>
          Done
        </span>
      </div>

      {status.error && (
        <div className="mt-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
          <p className="text-sm text-red-800 dark:text-red-200">
            {status.error}
          </p>
        </div>
      )}
    </div>
  );
}
