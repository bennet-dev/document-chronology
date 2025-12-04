import { create } from "zustand";
import { persist, createJSONStorage, StateStorage } from "zustand/middleware";
import { get, set, del } from "idb-keyval";
import type {
  ProcessingStatus,
  ProcessingPhase,
} from "@/lib/types/chronology";

const indexedDBStorage: StateStorage = {
  getItem: async (name: string): Promise<string | null> => {
    return (await get(name)) || null;
  },
  setItem: async (name: string, value: string): Promise<void> => {
    await set(name, value);
  },
  removeItem: async (name: string): Promise<void> => {
    await del(name);
  },
};

interface Store {
  // Document management
  uploadedDocs: string[];
  selectedDoc: string | null;
  currentDocumentId: string | null;
  addUploadedDoc: (doc: string) => void;
  removeUploadedDoc: (doc: string) => void;
  setSelectedDoc: (doc: string | null) => void;
  setCurrentDocumentId: (id: string | null) => void;
  clearUploadedDocs: () => void;

  // Processing status
  processingStatus: ProcessingStatus;
  setProcessingStatus: (status: Partial<ProcessingStatus>) => void;
  setProcessingPhase: (phase: ProcessingPhase, progress?: number) => void;

  // PDF viewer
  pdfUrl: string | null;
  viewerPage: number;
  viewerOpen: boolean;
  setPdfUrl: (url: string | null) => void;
  setViewerPage: (page: number) => void;
  openViewer: (page?: number) => void;
  closeViewer: () => void;

  // Timeline UI
  selectedClusterId: string | null;
  expandedDates: string[];
  setSelectedCluster: (id: string | null) => void;
  toggleDateExpanded: (date: string) => void;

  // Reset
  resetProcessing: () => void;
}

const initialProcessingStatus: ProcessingStatus = {
  phase: "idle",
  progress: 0,
};

export const useStore = create<Store>()(
  persist(
    (set) => ({
      // Document management
      uploadedDocs: [],
      selectedDoc: null,
      currentDocumentId: null,
      addUploadedDoc: (doc) =>
        set((state) => ({ uploadedDocs: [...state.uploadedDocs, doc] })),
      removeUploadedDoc: (doc) =>
        set((state) => ({
          uploadedDocs: state.uploadedDocs.filter((d) => d !== doc),
        })),
      setSelectedDoc: (doc) => set({ selectedDoc: doc }),
      setCurrentDocumentId: (id) => set({ currentDocumentId: id }),
      clearUploadedDocs: () => set({ uploadedDocs: [], selectedDoc: null, currentDocumentId: null }),

      // Processing status
      processingStatus: initialProcessingStatus,
      setProcessingStatus: (status) =>
        set((state) => ({
          processingStatus: { ...state.processingStatus, ...status },
        })),
      setProcessingPhase: (phase, progress) =>
        set((state) => ({
          processingStatus: {
            ...state.processingStatus,
            phase,
            progress: progress ?? state.processingStatus.progress,
          },
        })),

      // PDF viewer
      pdfUrl: null,
      viewerPage: 1,
      viewerOpen: false,
      setPdfUrl: (url) => set({ pdfUrl: url }),
      setViewerPage: (page) => set({ viewerPage: page }),
      openViewer: (page) =>
        set((state) => ({
          viewerOpen: true,
          viewerPage: page ?? state.viewerPage,
        })),
      closeViewer: () => set({ viewerOpen: false }),

      // Timeline UI
      selectedClusterId: null,
      expandedDates: [],
      setSelectedCluster: (id) => set({ selectedClusterId: id }),
      toggleDateExpanded: (date) =>
        set((state) => ({
          expandedDates: state.expandedDates.includes(date)
            ? state.expandedDates.filter((d) => d !== date)
            : [...state.expandedDates, date],
        })),

      // Reset
      resetProcessing: () =>
        set({
          processingStatus: initialProcessingStatus,
          pdfUrl: null,
          viewerPage: 1,
          viewerOpen: false,
          selectedClusterId: null,
          expandedDates: [],
        }),
    }),
    {
      name: "chronos-storage",
      storage: createJSONStorage(() => indexedDBStorage),
      partialize: (state) => ({
        // Only persist these fields
        uploadedDocs: state.uploadedDocs,
        selectedDoc: state.selectedDoc,
        currentDocumentId: state.currentDocumentId,
        pdfUrl: state.pdfUrl,
      }),
    }
  )
);
