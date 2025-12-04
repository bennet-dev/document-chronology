import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { format, parseISO } from "date-fns";

// GET /api/export?documentId=xxx - Export events as CSV
export async function GET(request: NextRequest) {
  try {
    const documentId = request.nextUrl.searchParams.get("documentId");

    if (!documentId) {
      return NextResponse.json(
        { error: "documentId is required" },
        { status: 400 }
      );
    }

    const document = await prisma.document.findUnique({
      where: { id: documentId },
    });

    if (!document) {
      return NextResponse.json(
        { error: "Document not found" },
        { status: 404 }
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

    // Build CSV
    const headers = ["Date", "Summary", "Type", "Page", "Primary", "Source", "Notes"];
    const rows = events.map((event) => {
      let formattedDate = event.date;
      try {
        formattedDate = format(parseISO(event.date), "yyyy-MM-dd");
      } catch {
        // Use raw date if parsing fails
      }

      return [
        formattedDate,
        escapeCsvField(event.summary),
        event.type,
        event.page?.pageNumber?.toString() || "",
        event.isPrimary ? "Yes" : "No",
        event.source,
        escapeCsvField(event.userNotes || ""),
      ];
    });

    const csv = [headers, ...rows]
      .map((row) => row.join(","))
      .join("\n");

    // Generate filename
    const baseFilename = document.filename.replace(/\.[^/.]+$/, "");
    const exportFilename = `${baseFilename}_events.csv`;

    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="${exportFilename}"`,
      },
    });
  } catch (error) {
    console.error("Error exporting events:", error);
    return NextResponse.json(
      { error: "Failed to export events" },
      { status: 500 }
    );
  }
}

function escapeCsvField(field: string): string {
  // If the field contains commas, quotes, or newlines, wrap in quotes and escape quotes
  if (field.includes(",") || field.includes('"') || field.includes("\n")) {
    return `"${field.replace(/"/g, '""')}"`;
  }
  return field;
}
