# Chronos Uplift Plan

## Current State

The app currently:
1. Extracts dates from medical records using regex
2. Uses heuristics to classify dates (DOS, DOB, fax, unknown)
3. Falls back to Gemini for ambiguous pages only
4. Picks ONE "date of service" per page
5. Groups pages into clusters by date
6. Stores everything in browser IndexedDB (no persistence)

## Problems Identified

### 1. Heuristic Gaps
- "Last updated", "Revised", "Effective date" are not recognized as relevant date indicators
- DOB detection works, but other irrelevant dates slip through
- No handling for "printed on", "generated" timestamps

### 2. Single Date Per Page Assumption
- Medical records often list multiple relevant dates on one page
- Examples: medication history, visit summaries, lab result series
- Current model loses this information by picking only one date

### 3. No Context for Dates
- Timeline shows dates and page numbers, but no description of what happened
- Lawyers need to know "Jan 15: ER visit for chest pain", not just "Jan 15: Page 3"

### 4. No Persistence
- Results lost if browser data cleared
- Re-processing same document wastes OCR/LLM calls
- No way to correct or annotate events

---

## Cost Analysis

### LLM Costs (Gemini 1.5 Flash)
- Input: $0.075 per 1M tokens
- Output: $0.30 per 1M tokens
- Per page: ~800 tokens in, ~150 tokens out = ~$0.00007/page
- **900-page document: ~$0.05-0.07**

### OCR Costs (Google Cloud Vision)
- $1.50 per 1,000 pages
- **900-page document: ~$1.35**

**Conclusion**: LLM is cheap. OCR is 20x more expensive. Run LLM on all pages with dates; focus caching efforts on OCR results.

---

## Architecture Overview

### Processing Pipeline

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Upload    │────▶│     OCR     │────▶│  LLM Pass   │────▶│   Store     │
│    PDF      │     │  (Vision)   │     │  (Gemini)   │     │  (Postgres) │
└─────────────┘     └─────────────┘     └─────────────┘     └─────────────┘
                           │                   │
                           ▼                   ▼
                    ┌─────────────┐     ┌─────────────┐
                    │    Cache    │     │    Cache    │
                    │  OCR Text   │     │   Events    │
                    └─────────────┘     └─────────────┘
```

### LLM Analysis Strategy

**Run LLM on every page that has at least one detected date.**

1. Regex identifies pages with dates (fast, free)
2. LLM analyzes ALL those pages to extract:
   - Multiple date events per page
   - Event summaries (<15 words each)
   - Event types (visit, lab, imaging, etc.)
   - Primary vs referenced date flag
3. Results cached in database
4. User can edit/correct any event

---

## Data Model

### DateEvent (Core Entity)

```typescript
interface DateEvent {
  id: string;
  documentId: string;
  pageNumber: number;

  // Date info
  date: string;              // ISO "2023-01-15"
  rawDateText: string;       // Original: "01/15/2023"

  // LLM-generated
  summary: string;           // "ER visit for chest pain"
  type: EventType;           // visit, lab, imaging, procedure, medication, note, other
  isPrimaryDate: boolean;    // True if this is when the document was created
  confidence: number;        // 0-1

  // Source tracking
  source: 'llm' | 'user';

  // User corrections
  userEdited: boolean;
  userNotes?: string;
}

type EventType = 'visit' | 'lab' | 'imaging' | 'procedure' | 'medication' | 'note' | 'other';
```

---

## Human-in-the-Loop

Even with LLM analysis on all pages, human input is valuable for:
- Correcting LLM mistakes
- Adding context the LLM missed
- Marking events as irrelevant
- Merging duplicate events

### Event Editing UI

Each event in the timeline is editable:

```
┌─────────────────────────────────────────────────────────────┐
│ 📅 2023-01-15                                               │
│                                                             │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ ER visit for chest pain                    [visit] p.3  │ │
│ │ ┌─ Edit ─┐                                              │ │
│ │ │ Summary: [ER visit for chest pain____]                │ │
│ │ │ Type:    [visit ▼]                                    │ │
│ │ │ Notes:   [Patient reported 8/10 pain__]               │ │
│ │ │                                                       │ │
│ │ │ [Save] [Delete] [Mark as Duplicate]                   │ │
│ │ └───────────────────────────────────────────────────────│ │
│ └─────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

### Add Event Manually

User can add events the LLM missed:

```
┌─────────────────────────────────────────────────────┐
│ + Add Event                                         │
│                                                     │
│ Date:    [2023-01-12]                               │
│ Summary: [Phone call with patient________]          │
│ Type:    [note ▼]                                   │
│ Page:    [15] (optional)                            │
│                                                     │
│ [Add Event]                                         │
└─────────────────────────────────────────────────────┘
```

---

## Database Setup

### Stack
- **PostgreSQL** - Relational database
- **Prisma** - ORM for type-safe queries
- **Docker** - Local development environment

### Prisma Schema

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model Document {
  id          String   @id @default(cuid())
  filename    String
  gcsPath     String   @unique
  fileHash    String?  @unique  // SHA-256 for deduplication

  uploadedAt  DateTime @default(now())
  processedAt DateTime?

  totalPages  Int?
  pagesWithDates Int?

  pages       Page[]
  events      DateEvent[]
}

model Page {
  id          String   @id @default(cuid())
  documentId  String
  document    Document @relation(fields: [documentId], references: [id], onDelete: Cascade)

  pageNumber  Int
  text        String   @db.Text

  // Processing state
  hasDate     Boolean  @default(false)
  llmAnalyzed Boolean  @default(false)

  events      DateEvent[]

  @@unique([documentId, pageNumber])
  @@index([documentId])
}

model DateEvent {
  id          String   @id @default(cuid())
  documentId  String
  document    Document @relation(fields: [documentId], references: [id], onDelete: Cascade)
  pageId      String?
  page        Page?    @relation(fields: [pageId], references: [id], onDelete: SetNull)

  // Date info
  date        String   // ISO date
  rawDateText String?  // Original matched text

  // LLM or user generated
  summary     String
  type        String   // visit, lab, imaging, procedure, medication, note, other
  isPrimary   Boolean  @default(false)
  confidence  Float    @default(1.0)

  // Source tracking
  source      String   // "llm" or "user"
  llmModel    String?  // e.g., "gemini-1.5-flash"

  // User corrections
  userEdited  Boolean  @default(false)
  userNotes   String?

  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@index([documentId])
  @@index([date])
}
```

### Docker Setup

**docker-compose.yml**
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

**Scripts in package.json**
```json
{
  "scripts": {
    "db:up": "docker-compose up -d",
    "db:down": "docker-compose down",
    "db:reset": "docker-compose down -v && docker-compose up -d && npx prisma migrate reset --force",
    "db:studio": "npx prisma studio",
    "db:migrate": "npx prisma migrate dev",
    "db:push": "npx prisma db push",
    "db:generate": "npx prisma generate"
  }
}
```

**Local .env**
```
DATABASE_URL="postgresql://chronos:chronos_dev@localhost:5432/chronos"
```

---

## LLM Prompt (Enhanced)

```
You are analyzing a page from medical records. Extract ALL clinically relevant date-event pairs.

For each date found, provide:
1. The date in ISO format (YYYY-MM-DD)
2. A brief summary of what happened (<15 words)
3. Event type: visit, lab, imaging, procedure, medication, note, or other
4. Whether this is the PRIMARY date (when the document was created/service rendered)
5. Your confidence level (0.0 to 1.0)

IGNORE these dates:
- Patient date of birth (DOB)
- Fax/transmission timestamps
- "Page X of Y" patterns
- Document print dates (unless it's the only date)

PAGE TEXT:
---
{pageText}
---

RESPOND WITH ONLY THIS JSON (no markdown, no explanation):
{
  "events": [
    {
      "date": "2023-01-15",
      "summary": "ER visit for chest pain",
      "type": "visit",
      "isPrimary": true,
      "confidence": 0.95
    }
  ],
  "documentType": "Emergency Department Note"
}

If no relevant dates are found, return: {"events": [], "documentType": null}
```

---

## Timeline UI Updates

### Event-Centric View

```
📅 January 15, 2023
├─ ER visit for chest pain (p.3) [visit] ✓
│   └─ Primary date for this document
├─ CBC, BMP ordered (p.4) [lab]
└─ Chest X-ray: no acute findings (p.5) [imaging]

📅 January 10, 2023
└─ Cardiology consult (referenced on p.3) [visit]
    └─ ⚠️ Referenced date, not primary

📅 January 5, 2023
└─ PCP visit for fatigue (p.8) [visit] ✏️ edited
    └─ User note: "This is when symptoms started"
```

### Features
- Color-coded event type badges
- Primary vs referenced date indicators
- Edit button on each event
- User notes displayed
- Click to jump to page in PDF viewer
- Filter by event type
- Search events

---

## Implementation Phases

### Phase 1: Database & Docker Setup
- [ ] Add docker-compose.yml for Postgres
- [ ] Install Prisma, create schema
- [ ] Add npm scripts for DB management
- [ ] Create initial migration
- [ ] Update .env.example

### Phase 2: API Refactor
- [ ] Create `/api/documents` CRUD endpoints
- [ ] Update `/api/process` to save to database
- [ ] Add document hash checking to skip re-OCR
- [ ] Create `/api/events` for event CRUD

### Phase 3: LLM on All Dated Pages
- [ ] Update `/api/classify` with new prompt
- [ ] Process all pages with dates (not just ambiguous)
- [ ] Extract multiple events per page
- [ ] Save events to database

### Phase 4: Timeline UI Overhaul
- [ ] Fetch events from database
- [ ] Display event-centric timeline
- [ ] Add event type badges
- [ ] Show primary vs referenced indicators

### Phase 5: Human-in-the-Loop
- [ ] Event editing modal
- [ ] Add manual event form
- [ ] Delete/merge events
- [ ] User notes field
- [ ] Save corrections to database

### Phase 6: Polish
- [ ] Event filtering by type
- [ ] Event search
- [ ] Export to CSV
- [ ] Loading states and error handling

---

## Duplicate Page Detection

Medical record PDFs often contain duplicate pages (faxed copies, re-scans, etc.). We need to detect these and flag them for review.

### Detection Strategy

1. **Text Similarity Hash**
   - Normalize OCR text (lowercase, remove whitespace, strip punctuation)
   - Generate a fuzzy hash (e.g., simhash or minhash) for each page
   - Pages with similarity > 95% are flagged as potential duplicates

2. **Exact Match Detection**
   - SHA-256 hash of normalized text
   - Catches identical pages immediately

3. **Near-Duplicate Grouping**
   - Use Jaccard similarity on word sets for fuzzy matching
   - Group pages into "duplicate clusters"

### Data Model Addition

```typescript
interface Page {
  // ... existing fields
  textHash: string;           // SHA-256 of normalized text
  simHash: string;            // Similarity hash for fuzzy matching
  duplicateOf?: string;       // Page ID this is a duplicate of
  duplicateConfidence?: number; // 0-1 similarity score
  isDuplicateReviewed: boolean; // User has reviewed this flag
}
```

### Prisma Schema Addition

```prisma
model Page {
  // ... existing fields
  textHash            String?
  simHash             String?
  duplicateOfId       String?
  duplicateOf         Page?    @relation("PageDuplicates", fields: [duplicateOfId], references: [id])
  duplicates          Page[]   @relation("PageDuplicates")
  duplicateConfidence Float?
  isDuplicateReviewed Boolean  @default(false)

  @@index([textHash])
  @@index([simHash])
}
```

### UI for Duplicate Review

```
┌─────────────────────────────────────────────────────────────┐
│ ⚠️ Potential Duplicates (3 groups found)                    │
│                                                             │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ Group 1: Pages 12, 47, 89 (98% similar)                 │ │
│ │                                                         │ │
│ │ [View Side-by-Side]  [Keep All]  [Mark as Duplicates]   │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ Group 2: Pages 23, 24 (96% similar)                     │ │
│ │                                                         │ │
│ │ [View Side-by-Side]  [Keep All]  [Mark as Duplicates]   │ │
│ └─────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

### Implementation Phase

Add to **Phase 3** or create new **Phase 3.5: Duplicate Detection**:
- [ ] Add text normalization utility
- [ ] Implement simhash algorithm (or use library like `simhash-js`)
- [ ] Compute hashes during OCR processing
- [ ] Create duplicate detection query
- [ ] Add `/api/duplicates` endpoint
- [ ] Build duplicate review UI component
- [ ] Add "Mark as Duplicate" action to timeline

---

## Open Questions

1. **Duplicate events**: Same visit on multiple pages. Show all or merge?
   - Recommendation: Show all, add "Mark as Duplicate" action <-- do this

2. **Duplicate pages**: How to handle confirmed duplicates?
   - Option A: Hide from timeline, show count badge
   - Option B: Collapse into primary page with expansion
   - Recommendation: Option B - keep them accessible but not cluttering <-- yes, option B

3. **Referenced dates**: How prominent in UI?
   - Recommendation: Subtle indicator, collapsible section <-- yes

4. **Event type accuracy**: Does misclassification matter?
   - Recommendation: Types are for filtering/visual only, user can correct

5. **Multi-tenancy**: Multiple users sharing documents?
   - Defer for now, but schema supports adding userId later
