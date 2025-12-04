"use client";

import { useState, useCallback } from "react";
import { useStore } from "@/lib/store";
import { ProcessingProgress } from "./components/ProcessingProgress";
import { EventTimeline } from "./components/EventTimeline";
import { EventEditModal } from "./components/EventEditModal";
import { AddEventForm } from "./components/AddEventForm";
import Link from "next/link";
import dynamic from "next/dynamic";
import type { EventResponse } from "@/app/api/events/route";

const PdfViewer = dynamic(() => import("./components/PdfViewer"), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-full">
      <div className="animate-spin h-8 w-8 border-2 border-blue-500 border-t-transparent rounded-full" />
    </div>
  ),
});

export default function TimelinePage() {
  const currentDocumentId = useStore((state) => state.currentDocumentId);
  const processingStatus = useStore((state) => state.processingStatus);
  const pdfUrl = useStore((state) => state.pdfUrl);
  const viewerOpen = useStore((state) => state.viewerOpen);
  const viewerPage = useStore((state) => state.viewerPage);
  const openViewer = useStore((state) => state.openViewer);
  const closeViewer = useStore((state) => state.closeViewer);
  const setViewerPage = useStore((state) => state.setViewerPage);

  const [editingEvent, setEditingEvent] = useState<EventResponse | null>(null);
  const [showAddEvent, setShowAddEvent] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const handlePageClick = (pageNumber: number) => {
    openViewer(pageNumber);
  };

  const handleEditEvent = useCallback(async (eventId: string) => {
    try {
      const response = await fetch(`/api/events/${eventId}`);
      if (response.ok) {
        const event = await response.json();
        setEditingEvent(event);
      }
    } catch (error) {
      console.error("Failed to fetch event:", error);
    }
  }, []);

  const handleSaveEvent = useCallback(
    async (
      eventId: string,
      updates: {
        date?: string;
        summary?: string;
        type?: string;
        userNotes?: string;
      }
    ) => {
      const response = await fetch(`/api/events/${eventId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
      if (!response.ok) throw new Error("Failed to save event");
      setRefreshKey((k) => k + 1);
    },
    []
  );

  const handleDeleteEvent = useCallback(async (eventId: string) => {
    const response = await fetch(`/api/events/${eventId}`, {
      method: "DELETE",
    });
    if (!response.ok) throw new Error("Failed to delete event");
    setRefreshKey((k) => k + 1);
  }, []);

  const handleAddEvent = useCallback(
    async (event: {
      date: string;
      summary: string;
      type: string;
      pageNumber?: number;
      userNotes?: string;
    }) => {
      const response = await fetch("/api/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          documentId: currentDocumentId,
          ...event,
        }),
      });
      if (!response.ok) throw new Error("Failed to add event");
      setRefreshKey((k) => k + 1);
    },
    [currentDocumentId]
  );

  const isProcessing = !["idle", "done", "error"].includes(
    processingStatus.phase
  );

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-900">
      <div
        className={`transition-all duration-300 ${
          viewerOpen ? "mr-[50%]" : ""
        }`}
      >
        <div className="max-w-4xl mx-auto p-8">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-50 mb-2">
              Document Timeline
            </h1>
            <p className="text-zinc-600 dark:text-zinc-400">
              Chronological view of your medical records
            </p>
          </div>

          {/* Processing status */}
          {(isProcessing || processingStatus.phase === "error") && (
            <div className="mb-8">
              <ProcessingProgress status={processingStatus} />
            </div>
          )}

          {/* No document state */}
          {!currentDocumentId && processingStatus.phase === "idle" && (
            <div className="bg-white dark:bg-zinc-800 rounded-xl border border-zinc-200 dark:border-zinc-700 p-12 text-center">
              <svg
                className="w-16 h-16 mx-auto text-zinc-400 mb-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
              <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50 mb-2">
                No Timeline Data
              </h2>
              <p className="text-zinc-600 dark:text-zinc-400 mb-6">
                Upload and process a document to see the chronological timeline.
              </p>
              <Link
                href="/upload"
                className="inline-flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
              >
                Go to Upload
                <svg
                  className="w-4 h-4 ml-2"
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
              </Link>
            </div>
          )}

          {/* Event Timeline */}
          {currentDocumentId && (
            <div className="bg-white dark:bg-zinc-800 rounded-xl border border-zinc-200 dark:border-zinc-700 p-6">
              {/* Header with Add Event and Export buttons */}
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                  Events
                </h2>
                <div className="flex items-center gap-2">
                  <a
                    href={`/api/export?documentId=${currentDocumentId}`}
                    download
                    className="inline-flex items-center gap-1 px-3 py-1.5 text-sm border border-zinc-300 dark:border-zinc-600 hover:bg-zinc-100 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 rounded-lg transition-colors"
                  >
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                      />
                    </svg>
                    Export CSV
                  </a>
                  <button
                    onClick={() => setShowAddEvent(true)}
                    className="inline-flex items-center gap-1 px-3 py-1.5 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                  >
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 4v16m8-8H4"
                      />
                    </svg>
                    Add Event
                  </button>
                </div>
              </div>

              <EventTimeline
                key={refreshKey}
                documentId={currentDocumentId}
                onPageClick={handlePageClick}
                onEditEvent={handleEditEvent}
              />
            </div>
          )}
        </div>
      </div>

      {/* PDF Viewer slide-over */}
      {viewerOpen && pdfUrl && (
        <div className="fixed top-0 right-0 w-1/2 h-screen bg-white dark:bg-zinc-800 border-l border-zinc-200 dark:border-zinc-700 shadow-xl z-50">
          <PdfViewer
            url={pdfUrl}
            currentPage={viewerPage}
            onPageChange={setViewerPage}
            onClose={closeViewer}
          />
        </div>
      )}

      {/* Edit Event Modal */}
      <EventEditModal
        event={editingEvent}
        isOpen={!!editingEvent}
        onClose={() => setEditingEvent(null)}
        onSave={handleSaveEvent}
        onDelete={handleDeleteEvent}
      />

      {/* Add Event Modal */}
      {currentDocumentId && (
        <AddEventForm
          documentId={currentDocumentId}
          isOpen={showAddEvent}
          onClose={() => setShowAddEvent(false)}
          onAdd={handleAddEvent}
        />
      )}
    </div>
  );
}
