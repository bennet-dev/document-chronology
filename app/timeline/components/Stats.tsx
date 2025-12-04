"use client";

import type { ChronologyResult } from "@/lib/types/chronology";

interface StatsProps {
  stats: ChronologyResult["stats"];
}

export function Stats({ stats }: StatsProps) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
      <div className="bg-white dark:bg-zinc-800 rounded-lg border border-zinc-200 dark:border-zinc-700 p-4">
        <p className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
          {stats.totalPages}
        </p>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">Total Pages</p>
      </div>
      <div className="bg-white dark:bg-zinc-800 rounded-lg border border-zinc-200 dark:border-zinc-700 p-4">
        <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
          {stats.pagesWithDates}
        </p>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Pages with Dates
        </p>
      </div>
      <div className="bg-white dark:bg-zinc-800 rounded-lg border border-zinc-200 dark:border-zinc-700 p-4">
        <p className="text-2xl font-bold text-green-600 dark:text-green-400">
          {stats.pagesWithDOS}
        </p>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Dated (Direct)
        </p>
      </div>
      <div className="bg-white dark:bg-zinc-800 rounded-lg border border-zinc-200 dark:border-zinc-700 p-4">
        <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">
          {stats.pagesInherited}
        </p>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Dated (Inherited)
        </p>
      </div>
      <div className="bg-white dark:bg-zinc-800 rounded-lg border border-zinc-200 dark:border-zinc-700 p-4">
        <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">
          {stats.llmClassified}
        </p>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">AI Classified</p>
      </div>
    </div>
  );
}
