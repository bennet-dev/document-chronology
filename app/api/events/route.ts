import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export type EventType =
  | "visit"
  | "lab"
  | "imaging"
  | "procedure"
  | "medication"
  | "note"
  | "other";

export interface EventResponse {
  id: string;
  documentId: string;
  pageId: string | null;
  pageNumber: number | null;
  date: string;
  rawDateText: string | null;
  summary: string;
  type: string;
  isPrimary: boolean;
  confidence: number;
  source: string;
  userEdited: boolean;
  userNotes: string | null;
  duplicateOfId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface EventsResponse {
  events: EventResponse[];
}

// GET /api/events?documentId=xxx - List events for a document
export async function GET(request: NextRequest) {
  try {
    const documentId = request.nextUrl.searchParams.get("documentId");

    if (!documentId) {
      return NextResponse.json(
        { error: "documentId is required" },
        { status: 400 }
      );
    }

    const events = await prisma.dateEvent.findMany({
      where: { documentId },
      orderBy: [{ date: "asc" }, { createdAt: "asc" }],
      include: {
        page: {
          select: { pageNumber: true },
        },
      },
    });

    const response: EventsResponse = {
      events: events.map((event) => ({
        id: event.id,
        documentId: event.documentId,
        pageId: event.pageId,
        pageNumber: event.page?.pageNumber ?? null,
        date: event.date,
        rawDateText: event.rawDateText,
        summary: event.summary,
        type: event.type,
        isPrimary: event.isPrimary,
        confidence: event.confidence,
        source: event.source,
        userEdited: event.userEdited,
        userNotes: event.userNotes,
        duplicateOfId: event.duplicateOfId,
        createdAt: event.createdAt.toISOString(),
        updatedAt: event.updatedAt.toISOString(),
      })),
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("Error fetching events:", error);
    return NextResponse.json(
      { error: "Failed to fetch events" },
      { status: 500 }
    );
  }
}

export interface CreateEventRequest {
  documentId: string;
  pageNumber?: number;
  date: string;
  summary: string;
  type: EventType;
  isPrimary?: boolean;
  userNotes?: string;
}

// POST /api/events - Create a new event (manual user creation)
export async function POST(request: NextRequest) {
  try {
    const body: CreateEventRequest = await request.json();
    const { documentId, pageNumber, date, summary, type, isPrimary, userNotes } =
      body;

    if (!documentId || !date || !summary || !type) {
      return NextResponse.json(
        { error: "documentId, date, summary, and type are required" },
        { status: 400 }
      );
    }

    // Verify document exists
    const document = await prisma.document.findUnique({
      where: { id: documentId },
    });

    if (!document) {
      return NextResponse.json(
        { error: "Document not found" },
        { status: 404 }
      );
    }

    // Find page if pageNumber provided
    let pageId: string | null = null;
    if (pageNumber !== undefined) {
      const page = await prisma.page.findUnique({
        where: {
          documentId_pageNumber: {
            documentId,
            pageNumber,
          },
        },
      });
      pageId = page?.id ?? null;
    }

    // Create event
    const event = await prisma.dateEvent.create({
      data: {
        documentId,
        pageId,
        date,
        summary,
        type,
        isPrimary: isPrimary ?? false,
        confidence: 1.0,
        source: "user",
        userEdited: false,
        userNotes,
      },
      include: {
        page: {
          select: { pageNumber: true },
        },
      },
    });

    const response: EventResponse = {
      id: event.id,
      documentId: event.documentId,
      pageId: event.pageId,
      pageNumber: event.page?.pageNumber ?? null,
      date: event.date,
      rawDateText: event.rawDateText,
      summary: event.summary,
      type: event.type,
      isPrimary: event.isPrimary,
      confidence: event.confidence,
      source: event.source,
      userEdited: event.userEdited,
      userNotes: event.userNotes,
      duplicateOfId: event.duplicateOfId,
      createdAt: event.createdAt.toISOString(),
      updatedAt: event.updatedAt.toISOString(),
    };

    return NextResponse.json(response, { status: 201 });
  } catch (error) {
    console.error("Error creating event:", error);
    return NextResponse.json(
      { error: "Failed to create event" },
      { status: 500 }
    );
  }
}
