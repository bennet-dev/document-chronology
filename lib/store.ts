import { create } from "zustand";
import { persist, createJSONStorage, StateStorage } from "zustand/middleware";
import { get, set, del } from "idb-keyval";
import type { PageDateConnection } from "@/app/api/process/route";

type Link = {
  id: string; // uuid
  date: string; // normalized ISO date or date range
  pageNumber: number;
};

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
  uploadedDocs: string[];
  selectedDoc: string | null;
  ocrResults: {
    text: string;
    pages: Record<string, string>[];
    connections: PageDateConnection[];
  } | null;
  detectedDates: string[];
  setDetectedDates: (dates: string[]) => void;
  setOcrResults: (
    results: {
      text: string;
      pages: Record<string, string>[];
      connections: PageDateConnection[];
    } | null
  ) => void;
  addUploadedDoc: (doc: string) => void;
  removeUploadedDoc: (doc: string) => void;
  setSelectedDoc: (doc: string | null) => void;
  clearUploadedDocs: () => void;
}

export const useStore = create<Store>()(
  persist(
    (set) => ({
      uploadedDocs: [],
      selectedDoc: null,
      ocrResults: null,
      detectedDates: [],
      setDetectedDates: (dates) => set({ detectedDates: dates }),
      setOcrResults: (results) => set({ ocrResults: results }),
      addUploadedDoc: (doc) =>
        set((state) => ({ uploadedDocs: [...state.uploadedDocs, doc] })),
      removeUploadedDoc: (doc) =>
        set((state) => ({
          uploadedDocs: state.uploadedDocs.filter((d) => d !== doc),
        })),
      setSelectedDoc: (doc) => set({ selectedDoc: doc }),
      clearUploadedDocs: () => set({ uploadedDocs: [], selectedDoc: null }),
    }),
    {
      name: "chronos-storage",
      storage: createJSONStorage(() => indexedDBStorage),
    }
  )
);
