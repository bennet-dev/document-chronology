# Implementation Plan: Chronos Uplift

This document contains the step-by-step implementation plan for the Chronos uplift. Each task is broken down into specific, actionable items.

---

## Phase 1: Database & Docker Setup

**Goal**: Set up PostgreSQL with Prisma and Docker for local development.

### 1.1 Docker Configuration
- [ ] Create `docker-compose.yml` in project root
  ```yaml
  version: '3.8'
  services:
    db:
      image: postgres:16-alpine
      container_name: chronos-db
      restart: unless-stopped
      environment:
        POSTGRES_USER: chronos
        POSTGRES_PASSWORD: chronos_dev
        POSTGRES_DB: chronos
      ports:
        - "5432:5432"
      volumes:
        - postgres_data:/var/lib/postgresql/data
  volumes:
    postgres_data:
  ```
- [ ] Add `docker-compose.yml` to `.gitignore` if it contains secrets (it doesn't here)
- [ ] Test: `docker-compose up -d` starts Postgres successfully

### 1.2 Prisma Setup
- [ ] Install dependencies: `npm install prisma @prisma/client`
- [ ] Initialize Prisma: `npx prisma init`
- [ ] Create `prisma/schema.prisma` with full schema:
  - Document model (id, filename, gcsPath, fileHash, timestamps, page counts)
  - Page model (id, documentId, pageNumber, text, hasDate, llmAnalyzed, duplicate fields)
  - DateEvent model (id, documentId, pageId, date, summary, type, isPrimary, confidence, source, userEdited, userNotes)
- [ ] Add duplicate detection fields to Page model:
  - textHash, simHash, duplicateOfId, duplicateConfidence, isDuplicateReviewed

### 1.3 NPM Scripts
- [ ] Add to `package.json`:
  ```json
  "db:up": "docker-compose up -d",
  "db:down": "docker-compose down",
  "db:reset": "docker-compose down -v && docker-compose up -d && sleep 2 && npx prisma migrate reset --force",
  "db:studio": "npx prisma studio",
  "db:migrate": "npx prisma migrate dev",
  "db:push": "npx prisma db push",
  "db:generate": "npx prisma generate"
  ```

### 1.4 Environment Setup
- [ ] Update `.env` with `DATABASE_URL="postgresql://chronos:chronos_dev@localhost:5432/chronos"`
- [ ] Create/update `.env.example` with placeholder
- [ ] Create initial migration: `npm run db:migrate -- --name init`
- [ ] Generate Prisma client: `npm run db:generate`

### 1.5 Database Client
- [ ] Create `lib/db.ts` with singleton Prisma client pattern for Next.js

**Verification**: Run `npm run db:up && npm run db:migrate && npm run db:studio` - should open Prisma Studio with empty tables.

---

## Phase 2: API Refactor

**Goal**: Update API endpoints to persist data to PostgreSQL.

### 2.1 Document CRUD API
- [ ] Create `app/api/documents/route.ts`
  - GET: List all documents with event counts
  - POST: Create document record (called after upload)
- [ ] Create `app/api/documents/[id]/route.ts`
  - GET: Get document with pages and events
  - DELETE: Delete document and cascade to pages/events

### 2.2 Update Upload Flow
- [ ] Modify `app/api/upload/route.ts`:
  - After GCS upload, create Document record in DB
  - Compute file hash (SHA-256) for deduplication
  - Return documentId in response
- [ ] Check for existing document with same fileHash before processing

### 2.3 Update Process Endpoint
- [ ] Modify `app/api/process/route.ts`:
  - Accept documentId instead of filename
  - Check if document already processed (pages exist)
  - If already processed, return cached results from DB
  - After OCR, save Page records to DB with text content
  - Compute textHash and simHash for each page during save

### 2.4 Events API
- [ ] Create `app/api/events/route.ts`
  - GET: List events for a document (query param: documentId)
  - POST: Create new event (for manual event creation)
- [ ] Create `app/api/events/[id]/route.ts`
  - GET: Get single event
  - PATCH: Update event (for editing summary, type, notes)
  - DELETE: Delete event

### 2.5 Duplicate Detection API
- [ ] Create `app/api/duplicates/route.ts`
  - GET: Get duplicate page groups for a document
  - Returns groups of pages with similarity scores
- [ ] Create `app/api/duplicates/[pageId]/route.ts`
  - PATCH: Mark page as duplicate of another, or mark as reviewed

**Verification**: Upload a document, check Prisma Studio shows Document and Page records.

---

## Phase 3: LLM on All Dated Pages

**Goal**: Run Gemini analysis on every page with dates, extract multiple events per page.

### 3.1 Text Normalization Utility
- [ ] Create `lib/utils/textHash.ts`:
  - `normalizeText(text: string): string` - lowercase, remove extra whitespace, strip punctuation
  - `computeTextHash(text: string): string` - SHA-256 of normalized text
  - `computeSimHash(text: string): string` - Simhash for fuzzy matching

### 3.2 Update Classify Endpoint
- [ ] Modify `app/api/classify/route.ts`:
  - Accept documentId and process ALL pages with dates (not just ambiguous)
  - Use enhanced LLM prompt that extracts multiple events per page
  - Save DateEvent records to database for each extracted event
  - Mark pages as llmAnalyzed after processing
  - Batch pages efficiently (5-10 per Gemini call)

### 3.3 Enhanced LLM Prompt
- [ ] Update prompt to:
  - Extract ALL clinically relevant date-event pairs
  - Return array of events with: date, summary, type, isPrimary, confidence
  - Include documentType detection
  - Ignore DOB, fax timestamps, print dates

### 3.4 Event Types
- [ ] Define event types: visit, lab, imaging, procedure, medication, note, other
- [ ] Store as string in DB (flexible for future additions)

### 3.5 Duplicate Page Detection Integration
- [ ] After OCR, compute hashes for each page
- [ ] Query for pages with matching textHash (exact duplicates)
- [ ] For non-exact matches, compute Jaccard similarity on simHash
- [ ] Flag pages with >95% similarity as potential duplicates

**Verification**: Process a document, check Prisma Studio shows multiple DateEvent records per page where applicable.

---

## Phase 4: Timeline UI Overhaul

**Goal**: Replace current timeline with event-centric view fetched from database.

### 4.1 Data Fetching
- [ ] Create `lib/hooks/useDocument.ts` - React Query or SWR hook for document data
- [ ] Create `lib/hooks/useEvents.ts` - Hook for events with filtering
- [ ] Create `lib/hooks/useDuplicates.ts` - Hook for duplicate page groups

### 4.2 Update Store
- [ ] Modify `lib/store.ts`:
  - Remove chronologyResult (now fetched from API)
  - Add currentDocumentId
  - Keep UI state: viewerPage, viewerOpen, expandedDates, filters

### 4.3 Event-Centric Timeline Component
- [ ] Create `app/timeline/components/EventTimeline.tsx`:
  - Fetch events from `/api/events?documentId=X`
  - Group events by date
  - Sort dates chronologically (newest first or oldest first - make configurable)
  - Render DateSection components for each date

### 4.4 Event Card Component
- [ ] Create `app/timeline/components/EventCard.tsx`:
  - Display: summary, type badge, page number, confidence indicator
  - Primary vs referenced date indicator (subtle)
  - Edit button (pencil icon)
  - Click to open PDF viewer at page
  - Show user notes if present
  - Show "edited" badge if userEdited=true

### 4.5 Event Type Badges
- [ ] Create `app/timeline/components/EventTypeBadge.tsx`:
  - Color-coded badges for each event type
  - visit: blue, lab: green, imaging: purple, procedure: red, medication: orange, note: gray, other: zinc

### 4.6 Referenced Date Handling
- [ ] Events with isPrimary=false shown with subtle styling
  - Lighter text color
  - Small "referenced" indicator
  - Collapsible section at bottom of date group

### 4.7 Duplicate Page Indicators
- [ ] Show duplicate badge on events from duplicate pages
- [ ] Collapse duplicates under primary page with expansion
- [ ] Show "(+2 duplicates)" count badge

**Verification**: Timeline displays events grouped by date with type badges and proper styling.

---

## Phase 5: Human-in-the-Loop

**Goal**: Allow users to edit, add, delete, and annotate events.

### 5.1 Event Editing Modal
- [ ] Create `app/timeline/components/EventEditModal.tsx`:
  - Form fields: summary (text), type (select), notes (textarea)
  - Date picker for changing event date
  - Save button calls PATCH `/api/events/[id]`
  - Sets userEdited=true on save

### 5.2 Add Event Form
- [ ] Create `app/timeline/components/AddEventForm.tsx`:
  - Date picker, summary input, type select, page number (optional)
  - Submit calls POST `/api/events`
  - Sets source='user'

### 5.3 Delete Event
- [ ] Add delete button to EventEditModal
  - Confirmation dialog
  - Calls DELETE `/api/events/[id]`

### 5.4 Mark as Duplicate
- [ ] Add "Mark as Duplicate" action to EventCard
  - Opens modal to select which event this duplicates
  - Updates event with duplicateOfId (or removes from timeline)

### 5.5 Duplicate Page Review UI
- [ ] Create `app/timeline/components/DuplicateReview.tsx`:
  - Shows groups of potential duplicate pages
  - Side-by-side PDF viewer comparison
  - Actions: Keep All, Mark as Duplicates, Dismiss
  - Updates page.isDuplicateReviewed and page.duplicateOfId

### 5.6 User Notes Display
- [ ] Show user notes inline on EventCard when present
- [ ] Expandable/collapsible for long notes

**Verification**: Can edit event summary, add new event, delete event, add notes - all persist to database.

---

## Phase 6: Polish

**Goal**: Add filtering, search, export, and improve UX.

### 6.1 Event Filtering
- [ ] Create `app/timeline/components/FilterBar.tsx`:
  - Event type checkboxes (show/hide by type)
  - Toggle: Show/hide referenced dates
  - Toggle: Show/hide duplicate events
  - Date range filter

### 6.2 Event Search
- [ ] Add search input to FilterBar
  - Filters events by summary text (client-side for small datasets)
  - Highlights matching text in results

### 6.3 Export to CSV
- [ ] Create `app/api/export/route.ts`:
  - GET with documentId query param
  - Returns CSV with columns: date, summary, type, page, notes
- [ ] Add "Export CSV" button to timeline header

### 6.4 Loading States
- [ ] Add skeleton loaders for timeline while fetching
- [ ] Add loading spinners for individual actions (edit, delete)
- [ ] Show progress during initial document processing

### 6.5 Error Handling
- [ ] Toast notifications for API errors
- [ ] Retry buttons for failed operations
- [ ] Graceful degradation when DB unavailable

### 6.6 Empty States
- [ ] "No events found" message with helpful text
- [ ] "No documents uploaded" on timeline page
- [ ] "Processing..." state with cancel option

**Verification**: Can filter by type, search events, export CSV, see proper loading/error states.

---

## File Summary

### New Files to Create
```
docker-compose.yml
prisma/schema.prisma
lib/db.ts
lib/utils/textHash.ts
lib/hooks/useDocument.ts
lib/hooks/useEvents.ts
lib/hooks/useDuplicates.ts
app/api/documents/route.ts
app/api/documents/[id]/route.ts
app/api/events/route.ts
app/api/events/[id]/route.ts
app/api/duplicates/route.ts
app/api/duplicates/[pageId]/route.ts
app/api/export/route.ts
app/timeline/components/EventTimeline.tsx
app/timeline/components/EventCard.tsx
app/timeline/components/EventTypeBadge.tsx
app/timeline/components/EventEditModal.tsx
app/timeline/components/AddEventForm.tsx
app/timeline/components/DuplicateReview.tsx
app/timeline/components/FilterBar.tsx
```

### Files to Modify
```
package.json (add scripts, dependencies)
.env (add DATABASE_URL)
.env.example (add placeholder)
lib/store.ts (update state shape)
app/api/upload/route.ts (create Document record)
app/api/process/route.ts (save to DB, check cache)
app/api/classify/route.ts (new prompt, save events)
app/timeline/page.tsx (use new components)
app/upload/page.tsx (use documentId flow)
```

---

## Dependencies to Add

```bash
npm install prisma @prisma/client
npm install crypto-js  # For hashing (or use Node crypto)
```

Optional (for better UX):
```bash
npm install @tanstack/react-query  # For data fetching
npm install sonner  # For toast notifications
npm install date-fns  # For date formatting
```

---

## Testing Checklist

After each phase:

- [ ] **Phase 1**: `npm run db:up && npm run db:studio` opens with schema
- [ ] **Phase 2**: Upload document → Document and Page records in DB
- [ ] **Phase 3**: Process document → DateEvent records with summaries
- [ ] **Phase 4**: Timeline shows events from DB, grouped by date
- [ ] **Phase 5**: Can edit/add/delete events, changes persist
- [ ] **Phase 6**: Filter, search, export all functional

---

## Decisions Made (from Open Questions)

1. **Duplicate events**: Show all, add "Mark as Duplicate" action
2. **Duplicate pages**: Collapse into primary page with expansion (Option B)
3. **Referenced dates**: Subtle indicator, collapsible section
4. **Event type accuracy**: Types are for filtering/visual only, user can correct
5. **Multi-tenancy**: Deferred, schema supports adding userId later
