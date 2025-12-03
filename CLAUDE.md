# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev      # Start development server (localhost:3000)
npm run build    # Production build
npm run lint     # Run ESLint
```

## Architecture

Chronos is a Next.js 16 application for document processing and chronological analysis. Users upload PDFs to Google Cloud Storage, run OCR via Google Cloud Vision API, extract dates from the text, and visualize page-date relationships as an interactive force-directed graph.

### Core Flow

1. **Upload** (`/upload`) - Files uploaded via drag-drop → API route saves to GCS bucket
2. **Process** - Google Vision async batch OCR extracts text per page
3. **Date Extraction** - `lib/chronology/findDates.ts` uses XRegExp to match various date formats
4. **Visualization** (`/graph`) - react-force-graph-2d renders page-date connections

### Key Files

- `lib/store.ts` - Zustand store persisted to IndexedDB (idb-keyval). Holds uploaded docs, selected doc, OCR results with page-date connections
- `lib/chronology/findDates.ts` - Date detection with regex patterns for ISO, DMY, MDY, month-name formats. `getDates()` returns ISO strings
- `lib/chronology/orderDates.ts` - Sorts date strings chronologically using date-fns
- `app/api/upload/route.ts` - Uploads files to GCS
- `app/api/process/route.ts` - Triggers Vision API OCR, parses JSON output shards, builds `PageDateConnection[]`

### State Shape

```typescript
{
  uploadedDocs: string[];           // GCS filenames
  selectedDoc: string | null;
  ocrResults: {
    text: string;
    pages: { pageNumber: number; text: string }[];
    connections: PageDateConnection[];  // { pageNumber, date }
  } | null;
}
```

## Environment Variables

Requires Google Cloud credentials:
- `GCS_PROJECT_ID`
- `GCS_CLIENT_EMAIL`
- `GCS_PRIVATE_KEY`
- `GCS_BUCKET_NAME`

## Tech Stack

- Next.js 16 (App Router)
- React 19
- Tailwind CSS 4
- Zustand + idb-keyval for client state persistence
- react-force-graph-2d for visualization
- XRegExp for date pattern matching
- date-fns for date parsing/sorting
