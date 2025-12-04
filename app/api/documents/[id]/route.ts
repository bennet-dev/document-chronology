import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export interface DocumentDetail {
  id: string;
  filename: string;
  gcsPath: string;
  uploadedAt: string;
  processedAt: string | null;
  totalPages: number | null;
  pagesWithDates: number | null;
  pages: {
    id: string;
    pageNumber: number;
    hasDate: boolean;
    llmAnalyzed: boolean;
    duplicateOfId: string | null;
    isDuplicateReviewed: boolean;
  }[];
  events: {
    id: string;
    pageId: string | null;
    pageNumber: number | null;
    date: string;
    summary: string;
    type: string;
    isPrimary: boolean;
    confidence: number;
    source: string;
    userEdited: boolean;
    userNotes: string | null;
  }[];
}

// GET /api/documents/[id] - Get document with pages and events
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const document = await prisma.document.findUnique({
      where: { id },
      include: {
        pages: {
          orderBy: { pageNumber: "asc" },
          select: {
            id: true,
            pageNumber: true,
            hasDate: true,
            llmAnalyzed: true,
            duplicateOfId: true,
            isDuplicateReviewed: true,
          },
        },
        events: {
          orderBy: [{ date: "asc" }, { createdAt: "asc" }],
          include: {
            page: {
              select: { pageNumber: true },
            },
          },
        },
      },
    });

    if (!document) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 });
    }

    const response: DocumentDetail = {
      id: document.id,
      filename: document.filename,
      gcsPath: document.gcsPath,
      uploadedAt: document.uploadedAt.toISOString(),
      processedAt: document.processedAt?.toISOString() ?? null,
      totalPages: document.totalPages,
      pagesWithDates: document.pagesWithDates,
      pages: document.pages,
      events: document.events.map((event) => ({
        id: event.id,
        pageId: event.pageId,
        pageNumber: event.page?.pageNumber ?? null,
        date: event.date,
        summary: event.summary,
        type: event.type,
        isPrimary: event.isPrimary,
        confidence: event.confidence,
        source: event.source,
        userEdited: event.userEdited,
        userNotes: event.userNotes,
      })),
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("Error fetching document:", error);
    return NextResponse.json(
      { error: "Failed to fetch document" },
      { status: 500 }
    );
  }
}

// DELETE /api/documents/[id] - Delete document and cascade to pages/events
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const document = await prisma.document.findUnique({
      where: { id },
    });

    if (!document) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 });
    }

    // Delete document (cascades to pages and events due to onDelete: Cascade)
    await prisma.document.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting document:", error);
    return NextResponse.json(
      { error: "Failed to delete document" },
      { status: 500 }
    );
  }
}
