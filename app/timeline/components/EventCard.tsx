"use client";

import { EventTypeBadge } from "./EventTypeBadge";

interface EventCardProps {
  event: {
    id: string;
    date: string;
    summary: string;
    type: string;
    pageNumber: number | null;
    isPrimary: boolean;
    confidence: number;
    source: string;
    userEdited: boolean;
    userNotes: string | null;
  };
  onPageClick?: (pageNumber: number) => void;
  onEdit?: (eventId: string) => void;
}

export function EventCard({ event, onPageClick, onEdit }: EventCardProps) {
  const handlePageClick = () => {
    if (event.pageNumber && onPageClick) {
      onPageClick(event.pageNumber);
    }
  };

  return (
    <div
      className={`group flex items-start gap-3 p-3 rounded-lg border transition-colors ${
        event.isPrimary
          ? "bg-white dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700"
          : "bg-zinc-50 dark:bg-zinc-800/50 border-zinc-100 dark:border-zinc-700/50"
      } hover:border-blue-300 dark:hover:border-blue-700`}
    >
      {/* Timeline dot */}
      <div className="flex-shrink-0 mt-1.5">
        <div
          className={`w-2 h-2 rounded-full ${
            event.isPrimary
              ? "bg-blue-500"
              : "bg-zinc-300 dark:bg-zinc-600"
          }`}
        />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <p
              className={`text-sm font-medium ${
                event.isPrimary
                  ? "text-zinc-900 dark:text-zinc-100"
                  : "text-zinc-600 dark:text-zinc-400"
              }`}
            >
              {event.summary}
            </p>

            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <EventTypeBadge type={event.type} />

              {event.pageNumber && (
                <button
                  onClick={handlePageClick}
                  className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 hover:bg-blue-200 dark:hover:bg-blue-900/50 rounded transition-colors"
                >
                  <svg
                    className="w-3 h-3"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                    />
                  </svg>
                  Page {event.pageNumber}
                </button>
              )}

              {!event.isPrimary && (
                <span className="text-xs text-zinc-400 dark:text-zinc-500 italic">
                  referenced
                </span>
              )}

              {event.userEdited && (
                <span className="text-xs text-amber-600 dark:text-amber-400">
                  edited
                </span>
              )}

              {event.confidence < 0.7 && (
                <span className="text-xs text-zinc-400 dark:text-zinc-500">
                  ({Math.round(event.confidence * 100)}% conf.)
                </span>
              )}
            </div>

            {event.userNotes && (
              <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400 italic border-l-2 border-zinc-200 dark:border-zinc-600 pl-2">
                {event.userNotes}
              </p>
            )}
          </div>

          {/* Edit button */}
          {onEdit && (
            <button
              onClick={() => onEdit(event.id)}
              className="opacity-0 group-hover:opacity-100 p-1 hover:bg-zinc-100 dark:hover:bg-zinc-700 rounded transition-opacity"
              title="Edit event"
            >
              <svg
                className="w-4 h-4 text-zinc-400 dark:text-zinc-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
                />
              </svg>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
