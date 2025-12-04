import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export interface DocumentListItem {
  id: string;
  filename: string;
  uploadedAt: string;
  processedAt: string | null;
  totalPages: number | null;
  pagesWithDates: number | null;
  eventCount: number;
}

export interface DocumentsResponse {
  documents: DocumentListItem[];
}

// GET /api/documents - List all documents
export async function GET() {
  try {
    const documents = await prisma.document.findMany({
      orderBy: { uploadedAt: "desc" },
      include: {
        _count: {
          select: { events: true },
        },
      },
    });

    const response: DocumentsResponse = {
      documents: documents.map((doc) => ({
        id: doc.id,
        filename: doc.filename,
        uploadedAt: doc.uploadedAt.toISOString(),
        processedAt: doc.processedAt?.toISOString() ?? null,
        totalPages: doc.totalPages,
        pagesWithDates: doc.pagesWithDates,
        eventCount: doc._count.events,
      })),
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("Error fetching documents:", error);
    return NextResponse.json(
      { error: "Failed to fetch documents" },
      { status: 500 }
    );
  }
}

export interface CreateDocumentRequest {
  filename: string;
  gcsPath: string;
  fileHash?: string;
}

export interface CreateDocumentResponse {
  id: string;
  filename: string;
  alreadyExists: boolean;
}

// POST /api/documents - Create a new document record
export async function POST(request: NextRequest) {
  try {
    const body: CreateDocumentRequest = await request.json();
    const { filename, gcsPath, fileHash } = body;

    if (!filename || !gcsPath) {
      return NextResponse.json(
        { error: "filename and gcsPath are required" },
        { status: 400 }
      );
    }

    // Check if document with same hash already exists
    if (fileHash) {
      const existing = await prisma.document.findUnique({
        where: { fileHash },
      });

      if (existing) {
        return NextResponse.json({
          id: existing.id,
          filename: existing.filename,
          alreadyExists: true,
        } as CreateDocumentResponse);
      }
    }

    // Check if document with same gcsPath exists
    const existingByPath = await prisma.document.findUnique({
      where: { gcsPath },
    });

    if (existingByPath) {
      return NextResponse.json({
        id: existingByPath.id,
        filename: existingByPath.filename,
        alreadyExists: true,
      } as CreateDocumentResponse);
    }

    // Create new document
    const document = await prisma.document.create({
      data: {
        filename,
        gcsPath,
        fileHash,
      },
    });

    return NextResponse.json({
      id: document.id,
      filename: document.filename,
      alreadyExists: false,
    } as CreateDocumentResponse);
  } catch (error) {
    console.error("Error creating document:", error);
    return NextResponse.json(
      { error: "Failed to create document" },
      { status: 500 }
    );
  }
}
