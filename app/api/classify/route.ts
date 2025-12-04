import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import type { ExtractedDate } from "@/lib/types/chronology";
import type { EventType } from "../events/route";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

interface PageToClassify {
  pageNumber: number;
  pageId?: string;
  text: string;
  extractedDates: ExtractedDate[];
}

interface ExtractedEvent {
  date: string;
  summary: string;
  type: EventType;
  isPrimary: boolean;
  confidence: number;
  rawDateText?: string;
}

interface PageClassificationResult {
  pageNumber: number;
  pageId?: string;
  events: ExtractedEvent[];
  documentType: string | null;
}

export interface ClassifyRequest {
  documentId: string;
  pages: PageToClassify[];
}

export interface ClassifyResponse {
  success: boolean;
  results: PageClassificationResult[];
  eventsCreated: number;
}

function buildPrompt(page: PageToClassify): string {
  return `You are analyzing a page from medical records. Extract ALL clinically relevant date-event pairs.

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
- "Revised" or "Updated" dates that refer to document updates, not clinical events

PAGE TEXT:
---
${page.text.slice(0, 3000)}
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

If no relevant dates are found, return: {"events": [], "documentType": null}`;
}

async function classifyPage(
  model: ReturnType<typeof genAI.getGenerativeModel>,
  page: PageToClassify
): Promise<PageClassificationResult> {
  try {
    const prompt = buildPrompt(page);
    const result = await model.generateContent(prompt);
    const response = result.response;
    let text = response.text().trim();

    // Remove markdown code blocks if present
    if (text.startsWith("```json")) {
      text = text.slice(7);
    } else if (text.startsWith("```")) {
      text = text.slice(3);
    }
    if (text.endsWith("```")) {
      text = text.slice(0, -3);
    }
    text = text.trim();

    // Parse JSON response
    const parsed = JSON.parse(text);

    const events: ExtractedEvent[] = (parsed.events || []).map(
      (e: {
        date: string;
        summary: string;
        type: string;
        isPrimary?: boolean;
        confidence?: number;
      }) => ({
        date: e.date,
        summary: e.summary,
        type: e.type as EventType,
        isPrimary: e.isPrimary ?? false,
        confidence: e.confidence ?? 0.5,
      })
    );

    return {
      pageNumber: page.pageNumber,
      pageId: page.pageId,
      events,
      documentType: parsed.documentType || null,
    };
  } catch (error) {
    console.error(`Error classifying page ${page.pageNumber}:`, error);
    return {
      pageNumber: page.pageNumber,
      pageId: page.pageId,
      events: [],
      documentType: null,
    };
  }
}

export async function POST(request: NextRequest) {
  console.log("[classify] Starting classification request");

  try {
    let body: ClassifyRequest;
    try {
      body = await request.json();
      console.log("[classify] Request body parsed:", {
        documentId: body.documentId,
        pageCount: body.pages?.length,
      });
    } catch (parseError) {
      console.error("[classify] Failed to parse request body:", parseError);
      return NextResponse.json(
        { error: "Invalid JSON in request body" },
        { status: 400 }
      );
    }

    const { documentId, pages } = body;

    if (!documentId) {
      console.error("[classify] Missing documentId");
      return NextResponse.json(
        { error: "documentId is required" },
        { status: 400 }
      );
    }

    if (!pages || pages.length === 0) {
      console.error("[classify] No pages provided");
      return NextResponse.json(
        { error: "No pages provided for classification" },
        { status: 400 }
      );
    }

    if (!process.env.GEMINI_API_KEY) {
      console.error("[classify] GEMINI_API_KEY not configured");
      return NextResponse.json(
        { error: "GEMINI_API_KEY not configured" },
        { status: 500 }
      );
    }

    // Verify document exists
    console.log("[classify] Looking up document:", documentId);
    let document;
    try {
      document = await prisma.document.findUnique({
        where: { id: documentId },
      });
    } catch (dbError) {
      console.error("[classify] Database error looking up document:", dbError);
      return NextResponse.json(
        { error: "Database error looking up document", details: String(dbError) },
        { status: 500 }
      );
    }

    if (!document) {
      console.error("[classify] Document not found:", documentId);
      return NextResponse.json(
        { error: "Document not found" },
        { status: 404 }
      );
    }

    console.log("[classify] Document found:", document.filename);

    // Get page IDs if not provided
    const pageMap = new Map<number, string>();
    if (pages.some((p) => !p.pageId)) {
      console.log("[classify] Fetching page IDs from database");
      try {
        const dbPages = await prisma.page.findMany({
          where: { documentId },
          select: { id: true, pageNumber: true },
        });
        console.log("[classify] Found", dbPages.length, "pages in database");
        dbPages.forEach((p) => pageMap.set(p.pageNumber, p.id));
      } catch (dbError) {
        console.error("[classify] Database error fetching pages:", dbError);
        return NextResponse.json(
          { error: "Database error fetching pages", details: String(dbError) },
          { status: 500 }
        );
      }
    }

    // Enrich pages with pageIds
    const enrichedPages = pages.map((p) => ({
      ...p,
      pageId: p.pageId || pageMap.get(p.pageNumber),
    }));

    console.log("[classify] Enriched pages:", enrichedPages.length, "pages,",
      enrichedPages.filter(p => p.pageId).length, "have pageIds");

    // Use Gemini Flash for cost efficiency
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

    // Process pages in parallel (with some concurrency limit)
    const BATCH_SIZE = 5;
    const results: PageClassificationResult[] = [];

    console.log("[classify] Starting LLM classification for", enrichedPages.length, "pages");
    for (let i = 0; i < enrichedPages.length; i += BATCH_SIZE) {
      const batch = enrichedPages.slice(i, i + BATCH_SIZE);
      console.log(`[classify] Processing batch ${i / BATCH_SIZE + 1}, pages ${i + 1}-${i + batch.length}`);
      const batchResults = await Promise.all(
        batch.map((page) => classifyPage(model, page))
      );
      results.push(...batchResults);
    }

    console.log("[classify] LLM classification complete, processing results");

    // Save events to database
    let eventsCreated = 0;
    const eventsToCreate: {
      documentId: string;
      pageId: string | null;
      date: string;
      summary: string;
      type: string;
      isPrimary: boolean;
      confidence: number;
      source: string;
      llmModel: string;
    }[] = [];

    for (const result of results) {
      for (const event of result.events) {
        eventsToCreate.push({
          documentId,
          pageId: result.pageId || null,
          date: event.date,
          summary: event.summary,
          type: event.type,
          isPrimary: event.isPrimary,
          confidence: event.confidence,
          source: "llm",
          llmModel: "gemini-2.0-flash",
        });
      }

      // Mark page as analyzed
      if (result.pageId) {
        try {
          await prisma.page.update({
            where: { id: result.pageId },
            data: { llmAnalyzed: true },
          });
        } catch (updateError) {
          console.error("[classify] Failed to update page", result.pageId, ":", updateError);
        }
      }
    }

    console.log("[classify] Preparing to create", eventsToCreate.length, "events");

    if (eventsToCreate.length > 0) {
      try {
        await prisma.dateEvent.createMany({
          data: eventsToCreate,
        });
        eventsCreated = eventsToCreate.length;
        console.log("[classify] Created", eventsCreated, "events");
      } catch (createError) {
        console.error("[classify] Failed to create events:", createError);
        return NextResponse.json(
          { error: "Failed to save events to database", details: String(createError) },
          { status: 500 }
        );
      }
    }

    const response: ClassifyResponse = {
      success: true,
      results,
      eventsCreated,
    };

    console.log("[classify] Classification complete, returning response");
    return NextResponse.json(response);
  } catch (error) {
    console.error("[classify] Unexpected error:", error);
    console.error("[classify] Error stack:", error instanceof Error ? error.stack : "No stack");
    return NextResponse.json(
      { error: "Failed to classify dates", details: String(error) },
      { status: 500 }
    );
  }
}
