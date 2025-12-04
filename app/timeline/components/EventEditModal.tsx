"use client";

import { useState, useEffect } from "react";
import type { EventResponse } from "@/app/api/events/route";

interface EventEditModalProps {
  event: EventResponse | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (eventId: string, updates: EventUpdates) => Promise<void>;
  onDelete: (eventId: string) => Promise<void>;
}

interface EventUpdates {
  date?: string;
  summary?: string;
  type?: string;
  userNotes?: string;
}

const EVENT_TYPES = [
  "visit",
  "lab",
  "imaging",
  "procedure",
  "medication",
  "note",
  "other",
];

export function EventEditModal({
  event,
  isOpen,
  onClose,
  onSave,
  onDelete,
}: EventEditModalProps) {
  const [date, setDate] = useState("");
  const [summary, setSummary] = useState("");
  const [type, setType] = useState("other");
  const [userNotes, setUserNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => {
    if (event) {
      setDate(event.date);
      setSummary(event.summary);
      setType(event.type);
      setUserNotes(event.userNotes || "");
    }
  }, [event]);

  if (!isOpen || !event) return null;

  const handleSave = async () => {
    setSaving(true);
    setSaveError(null);
    try {
      await onSave(event.id, {
        date,
        summary,
        type,
        userNotes: userNotes || undefined,
      });
      onClose();
    } catch (error) {
      console.error("Failed to save event:", error);
      setSaveError(error instanceof Error ? error.message : "Failed to save changes");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    setDeleteError(null);
    try {
      await onDelete(event.id);
      onClose();
    } catch (error) {
      console.error("Failed to delete event:", error);
      setDeleteError(error instanceof Error ? error.message : "Failed to delete event");
    } finally {
      setDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-white dark:bg-zinc-800 rounded-xl shadow-xl w-full max-w-md mx-4 p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">
            Edit Event
          </h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-zinc-100 dark:hover:bg-zinc-700 rounded"
          >
            <svg
              className="w-5 h-5 text-zinc-500"
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
          </button>
        </div>

        <div className="space-y-4">
          {/* Date */}
          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
              Date
            </label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Summary */}
          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
              Summary
            </label>
            <input
              type="text"
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Brief description of the event"
            />
          </div>

          {/* Type */}
          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
              Type
            </label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {EVENT_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t.charAt(0).toUpperCase() + t.slice(1)}
                </option>
              ))}
            </select>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
              Notes
            </label>
            <textarea
              value={userNotes}
              onChange={(e) => setUserNotes(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              placeholder="Add notes about this event..."
            />
          </div>

          {/* Source info */}
          <div className="text-xs text-zinc-500 dark:text-zinc-400">
            Source: {event.source}
            {event.pageNumber && ` · Page ${event.pageNumber}`}
            {event.userEdited && " · Previously edited"}
          </div>

          {/* Error messages */}
          {(saveError || deleteError) && (
            <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
              <p className="text-sm text-red-800 dark:text-red-200">
                {saveError || deleteError}
              </p>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between mt-6 pt-4 border-t border-zinc-200 dark:border-zinc-700">
          {showDeleteConfirm ? (
            <div className="flex items-center gap-2">
              <span className="text-sm text-red-600 dark:text-red-400">
                Delete this event?
              </span>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="px-3 py-1 text-sm bg-red-600 hover:bg-red-700 text-white rounded-lg disabled:opacity-50"
              >
                {deleting ? "Deleting..." : "Yes, delete"}
              </button>
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="px-3 py-1 text-sm text-zinc-600 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="text-sm text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300"
            >
              Delete event
            </button>
          )}

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm text-zinc-600 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving || !summary.trim()}
              className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save changes"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
