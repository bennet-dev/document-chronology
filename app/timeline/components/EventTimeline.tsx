"use client";

import { useState, useEffect, useMemo } from "react";
import { format, parseISO } from "date-fns";
import { EventCard } from "./EventCard";
import { EventTypeBadge } from "./EventTypeBadge";
import type { EventResponse } from "@/app/api/events/route";

interface EventTimelineProps {
  documentId: string;
  onPageClick: (pageNumber: number) => void;
  onEditEvent?: (eventId: string) => void;
}

interface DateGroup {
  date: string;
  displayDate: string;
  events: EventResponse[];
}

const EVENT_TYPES = [
  "visit",
  "lab",
  "imaging",
  "procedure",
  "medication",
  "note",
  "other",
] as const;

export function EventTimeline({
  documentId,
  onPageClick,
  onEditEvent,
}: EventTimelineProps) {
  const [events, setEvents] = useState<EventResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedDates, setExpandedDates] = useState<Set<string>>(new Set());
  const [activeFilters, setActiveFilters] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  useEffect(() => {
    async function fetchEvents() {
      try {
        setLoading(true);
        const response = await fetch(`/api/events?documentId=${documentId}`);
        if (!response.ok) throw new Error("Failed to fetch events");
        const data = await response.json();
        setEvents(data.events);

        // Auto-expand first 5 dates
        const dates = [...new Set(data.events.map((e: EventResponse) => e.date))].slice(0, 5) as string[];
        setExpandedDates(new Set<string>(dates));
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load events");
      } finally {
        setLoading(false);
      }
    }

    if (documentId) {
      fetchEvents();
    }
  }, [documentId]);

  // Filter events based on active filters and search query
  const filteredEvents = useMemo(() => {
    return events.filter((event) => {
      // Type filter
      if (activeFilters.size > 0 && !activeFilters.has(event.type)) {
        return false;
      }
      // Search filter
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        return (
          event.summary.toLowerCase().includes(query) ||
          event.userNotes?.toLowerCase().includes(query) ||
          event.type.toLowerCase().includes(query)
        );
      }
      return true;
    });
  }, [events, activeFilters, searchQuery]);

  // Get type counts for filter badges
  const typeCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    events.forEach((event) => {
      counts[event.type] = (counts[event.type] || 0) + 1;
    });
    return counts;
  }, [events]);

  const toggleFilter = (type: string) => {
    setActiveFilters((prev) => {
      const next = new Set(prev);
      if (next.has(type)) {
        next.delete(type);
      } else {
        next.add(type);
      }
      return next;
    });
  };

  const clearFilters = () => {
    setActiveFilters(new Set());
    setSearchQuery("");
  };

  // Group events by date
  const dateGroups: DateGroup[] = filteredEvents.reduce((groups, event) => {
    const existing = groups.find((g) => g.date === event.date);
    if (existing) {
      existing.events.push(event);
    } else {
      let displayDate = event.date;
      try {
        displayDate = format(parseISO(event.date), "MMMM d, yyyy");
      } catch {
        // Use raw date if parsing fails
      }
      groups.push({
        date: event.date,
        displayDate,
        events: [event],
      });
    }
    return groups;
  }, [] as DateGroup[]);

  // Sort by date based on sortOrder
  dateGroups.sort((a, b) =>
    sortOrder === "desc"
      ? b.date.localeCompare(a.date)
      : a.date.localeCompare(b.date)
  );

  const toggleDate = (date: string) => {
    setExpandedDates((prev) => {
      const next = new Set(prev);
      if (next.has(date)) {
        next.delete(date);
      } else {
        next.add(date);
      }
      return next;
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin h-8 w-8 border-2 border-blue-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <p className="text-red-600 dark:text-red-400">{error}</p>
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <div className="text-center py-12">
        <svg
          className="w-12 h-12 mx-auto text-zinc-400 mb-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
          />
        </svg>
        <h3 className="text-lg font-medium text-zinc-900 dark:text-zinc-100 mb-1">
          No Events Found
        </h3>
        <p className="text-zinc-500 dark:text-zinc-400">
          No date events were extracted from this document.
        </p>
      </div>
    );
  }

  const hasActiveFilters = activeFilters.size > 0 || searchQuery.trim();

  return (
    <div className="space-y-4">
      {/* Search and filters */}
      <div className="space-y-3 mb-6">
        {/* Search input */}
        <div className="relative">
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
          <input
            type="text"
            placeholder="Search events..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-zinc-200 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        {/* Type filters */}
        <div className="flex flex-wrap gap-2">
          {EVENT_TYPES.map((type) => {
            const count = typeCounts[type] || 0;
            if (count === 0) return null;
            const isActive = activeFilters.has(type);
            return (
              <button
                key={type}
                onClick={() => toggleFilter(type)}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-all ${
                  isActive
                    ? "ring-2 ring-blue-500 ring-offset-1 dark:ring-offset-zinc-900"
                    : "opacity-70 hover:opacity-100"
                }`}
              >
                <EventTypeBadge type={type} />
                <span className="text-zinc-500 dark:text-zinc-400">({count})</span>
              </button>
            );
          })}
          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              className="text-xs text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-300 underline"
            >
              Clear filters
            </button>
          )}
        </div>
      </div>

      {/* Stats and controls */}
      <div className="flex items-center justify-between text-sm text-zinc-500 dark:text-zinc-400 mb-6">
        <span>
          {hasActiveFilters ? (
            <>
              {filteredEvents.length} of {events.length} events
              {dateGroups.length > 0 && ` across ${dateGroups.length} dates`}
            </>
          ) : (
            <>{events.length} events across {dateGroups.length} dates</>
          )}
        </span>
        <div className="flex items-center gap-3">
          {/* Sort order toggle */}
          <button
            onClick={() => setSortOrder(sortOrder === "desc" ? "asc" : "desc")}
            className="inline-flex items-center gap-1.5 px-2 py-1 hover:bg-zinc-100 dark:hover:bg-zinc-700 rounded transition-colors"
            title={sortOrder === "desc" ? "Showing newest first" : "Showing oldest first"}
          >
            <svg
              className={`w-4 h-4 transition-transform ${sortOrder === "asc" ? "rotate-180" : ""}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M3 4h13M3 8h9m-9 4h6m4 0l4-4m0 0l4 4m-4-4v12"
              />
            </svg>
            <span>{sortOrder === "desc" ? "Newest first" : "Oldest first"}</span>
          </button>
          <span className="text-zinc-300 dark:text-zinc-600">|</span>
          <button
            onClick={() => setExpandedDates(new Set(dateGroups.map((g) => g.date)))}
            className="hover:text-zinc-700 dark:hover:text-zinc-300"
          >
            Expand all
          </button>
          <span className="text-zinc-300 dark:text-zinc-600">|</span>
          <button
            onClick={() => setExpandedDates(new Set())}
            className="hover:text-zinc-700 dark:hover:text-zinc-300"
          >
            Collapse all
          </button>
        </div>
      </div>

      {/* No results message */}
      {hasActiveFilters && filteredEvents.length === 0 && (
        <div className="text-center py-8">
          <p className="text-zinc-500 dark:text-zinc-400">
            No events match your filters.
          </p>
          <button
            onClick={clearFilters}
            className="mt-2 text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
          >
            Clear filters
          </button>
        </div>
      )}

      {/* Date groups */}
      {dateGroups.map((group) => {
        const isExpanded = expandedDates.has(group.date);
        const primaryEvents = group.events.filter((e) => e.isPrimary);
        const referencedEvents = group.events.filter((e) => !e.isPrimary);

        return (
          <div
            key={group.date}
            className="border border-zinc-200 dark:border-zinc-700 rounded-lg overflow-hidden"
          >
            {/* Date header */}
            <button
              onClick={() => toggleDate(group.date)}
              className="w-full flex items-center justify-between p-4 bg-zinc-50 dark:bg-zinc-800/50 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
            >
              <div className="flex items-center gap-3">
                <svg
                  className={`w-5 h-5 text-zinc-400 transition-transform ${
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
                <span className="font-medium text-zinc-900 dark:text-zinc-100">
                  {group.displayDate}
                </span>
              </div>
              <span className="text-sm text-zinc-500 dark:text-zinc-400">
                {group.events.length} event{group.events.length !== 1 ? "s" : ""}
              </span>
            </button>

            {/* Events */}
            {isExpanded && (
              <div className="p-4 space-y-2">
                {/* Primary events first */}
                {primaryEvents.map((event) => (
                  <EventCard
                    key={event.id}
                    event={event}
                    onPageClick={onPageClick}
                    onEdit={onEditEvent}
                  />
                ))}

                {/* Referenced events */}
                {referencedEvents.length > 0 && (
                  <>
                    {primaryEvents.length > 0 && (
                      <div className="border-t border-zinc-100 dark:border-zinc-700/50 my-2 pt-2">
                        <span className="text-xs text-zinc-400 dark:text-zinc-500">
                          Referenced dates
                        </span>
                      </div>
                    )}
                    {referencedEvents.map((event) => (
                      <EventCard
                        key={event.id}
                        event={event}
                        onPageClick={onPageClick}
                        onEdit={onEditEvent}
                      />
                    ))}
                  </>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
