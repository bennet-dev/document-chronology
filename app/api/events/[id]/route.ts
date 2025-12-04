import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import type { EventResponse } from "../route";

// GET /api/events/[id] - Get a single event
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const event = await prisma.dateEvent.findUnique({
      where: { id },
      include: {
        page: {
          select: { pageNumber: true },
        },
      },
    });

    if (!event) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }

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

    return NextResponse.json(response);
  } catch (error) {
    console.error("Error fetching event:", error);
    return NextResponse.json(
      { error: "Failed to fetch event" },
      { status: 500 }
    );
  }
}

export interface UpdateEventRequest {
  date?: string;
  summary?: string;
  type?: string;
  isPrimary?: boolean;
  userNotes?: string;
  duplicateOfId?: string | null;
}

// PATCH /api/events/[id] - Update an event
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body: UpdateEventRequest = await request.json();

    const existing = await prisma.dateEvent.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }

    // Build update data
    const updateData: Record<string, unknown> = {};

    if (body.date !== undefined) updateData.date = body.date;
    if (body.summary !== undefined) updateData.summary = body.summary;
    if (body.type !== undefined) updateData.type = body.type;
    if (body.isPrimary !== undefined) updateData.isPrimary = body.isPrimary;
    if (body.userNotes !== undefined) updateData.userNotes = body.userNotes;
    if (body.duplicateOfId !== undefined)
      updateData.duplicateOfId = body.duplicateOfId;

    // Mark as user edited if any content fields changed
    if (
      body.date !== undefined ||
      body.summary !== undefined ||
      body.type !== undefined ||
      body.userNotes !== undefined
    ) {
      updateData.userEdited = true;
    }

    const event = await prisma.dateEvent.update({
      where: { id },
      data: updateData,
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

    return NextResponse.json(response);
  } catch (error) {
    console.error("Error updating event:", error);
    return NextResponse.json(
      { error: "Failed to update event" },
      { status: 500 }
    );
  }
}

// DELETE /api/events/[id] - Delete an event
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const existing = await prisma.dateEvent.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }

    await prisma.dateEvent.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting event:", error);
    return NextResponse.json(
      { error: "Failed to delete event" },
      { status: 500 }
    );
  }
}
