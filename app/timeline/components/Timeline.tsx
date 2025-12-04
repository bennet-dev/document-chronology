"use client";

import { useMemo } from "react";
import type { ChronologyResult, PageCluster } from "@/lib/types/chronology";
import { format, parseISO } from "date-fns";

interface TimelineProps {
  chronologyResult: ChronologyResult;
  expandedDates: string[];
  onToggleDate: (date: string) => void;
  onPageClick: (pageNumber: number) => void;
  selectedClusterId: string | null;
  onClusterSelect: (id: string) => void;
}

export function Timeline({
  chronologyResult,
  expandedDates,
  onToggleDate,
  onPageClick,
  selectedClusterId,
  onClusterSelect,
}: TimelineProps) {
  // Group clusters by date
  const clustersByDate = useMemo(() => {
    const map = new Map<string, PageCluster[]>();
    for (const cluster of chronologyResult.clusters) {
      const existing = map.get(cluster.dateOfService) || [];
      existing.push(cluster);
      map.set(cluster.dateOfService, existing);
    }
    // Sort dates chronologically
    return Array.from(map.entries()).sort(
      ([a], [b]) => new Date(a).getTime() - new Date(b).getTime()
    );
  }, [chronologyResult.clusters]);

  const formatDate = (dateStr: string) => {
    try {
      return format(parseISO(dateStr), "MMMM d, yyyy");
    } catch {
      return dateStr;
    }
  };

  const formatPageRange = (pages: number[]) => {
    if (pages.length === 1) return `p. ${pages[0]}`;
    const sorted = [...pages].sort((a, b) => a - b);

    // Check if consecutive
    const isConsecutive = sorted.every(
      (p, i) => i === 0 || p === sorted[i - 1] + 1
    );

    if (isConsecutive) {
      return `pp. ${sorted[0]}-${sorted[sorted.length - 1]}`;
    }
    return `pp. ${sorted.join(", ")}`;
  };

  return (
    <div className="relative">
      {/* Timeline line */}
      <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-zinc-300 dark:bg-zinc-600" />

      <div className="space-y-6">
        {clustersByDate.map(([date, clusters]) => {
          const isExpanded = expandedDates.includes(date);
          const totalPages = clusters.reduce(
            (sum, c) => sum + c.pages.length,
            0
          );

          return (
            <div key={date} className="relative">
              {/* Date marker */}
              <button
                onClick={() => onToggleDate(date)}
                className="flex items-center gap-3 group w-full text-left"
              >
                <div className="relative z-10 w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center shadow-md group-hover:bg-blue-600 transition-colors">
                  <svg
                    className={`w-4 h-4 text-white transition-transform ${
                      isExpanded ? "rotate-90" : ""
                    }`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 5l7 7-7 7"
                    />
                  </svg>
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
                    {formatDate(date)}
                  </h3>
                  <p className="text-sm text-zinc-500 dark:text-zinc-400">
                    {clusters.length} document{clusters.length !== 1 ? "s" : ""},{" "}
                    {totalPages} page{totalPages !== 1 ? "s" : ""}
                  </p>
                </div>
              </button>

              {/* Clusters for this date */}
              {isExpanded && (
                <div className="ml-12 mt-3 space-y-2">
                  {clusters.map((cluster) => (
                    <button
                      key={cluster.id}
                      onClick={() => {
                        onClusterSelect(cluster.id);
                        onPageClick(cluster.primaryPage);
                      }}
                      className={`w-full text-left p-3 rounded-lg border transition-all ${
                        selectedClusterId === cluster.id
                          ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
                          : "border-zinc-200 dark:border-zinc-700 hover:border-zinc-300 dark:hover:border-zinc-600 bg-white dark:bg-zinc-800"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="font-medium text-zinc-900 dark:text-zinc-100">
                            {cluster.documentType || "Document"}
                          </span>
                          <span className="ml-2 text-sm text-zinc-500 dark:text-zinc-400">
                            ({formatPageRange(cluster.pages)})
                          </span>
                        </div>
                        <svg
                          className="w-5 h-5 text-zinc-400"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M9 5l7 7-7 7"
                          />
                        </svg>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}

        {/* Undated section */}
        {chronologyResult.undatedPages.length > 0 && (
          <div className="relative">
            <div className="flex items-center gap-3">
              <div className="relative z-10 w-8 h-8 rounded-full bg-amber-500 flex items-center justify-center shadow-md">
                <svg
                  className="w-4 h-4 text-white"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                  />
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
                  Undated Pages
                </h3>
                <p className="text-sm text-zinc-500 dark:text-zinc-400">
                  {chronologyResult.undatedPages.length} page
                  {chronologyResult.undatedPages.length !== 1 ? "s" : ""} could
                  not be dated
                </p>
              </div>
            </div>
            <div className="ml-12 mt-3">
              <div className="p-3 rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20">
                <p className="text-sm text-amber-800 dark:text-amber-200">
                  Pages: {chronologyResult.undatedPages.join(", ")}
                </p>
                <button
                  onClick={() => onPageClick(chronologyResult.undatedPages[0])}
                  className="mt-2 text-sm text-amber-600 dark:text-amber-400 hover:underline"
                >
                  View first undated page →
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
