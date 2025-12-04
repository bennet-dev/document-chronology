import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export interface UpdateDuplicateRequest {
  duplicateOfId?: string | null;
  isDuplicateReviewed?: boolean;
}

// PATCH /api/duplicates/[pageId] - Mark page as duplicate or reviewed
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ pageId: string }> }
) {
  try {
    const { pageId } = await params;
    const body: UpdateDuplicateRequest = await request.json();

    const existing = await prisma.page.findUnique({
      where: { id: pageId },
    });

    if (!existing) {
      return NextResponse.json({ error: "Page not found" }, { status: 404 });
    }

    const updateData: Record<string, unknown> = {};

    if (body.duplicateOfId !== undefined) {
      updateData.duplicateOfId = body.duplicateOfId;

      // If marking as duplicate, also compute confidence
      if (body.duplicateOfId) {
        const primaryPage = await prisma.page.findUnique({
          where: { id: body.duplicateOfId },
        });

        if (primaryPage && existing.simHash && primaryPage.simHash) {
          // Import similarity function inline to avoid circular deps
          const { simHashSimilarity } = await import("@/lib/utils/textHash");
          updateData.duplicateConfidence = simHashSimilarity(
            existing.simHash,
            primaryPage.simHash
          );
        }
      } else {
        updateData.duplicateConfidence = null;
      }
    }

    if (body.isDuplicateReviewed !== undefined) {
      updateData.isDuplicateReviewed = body.isDuplicateReviewed;
    }

    const page = await prisma.page.update({
      where: { id: pageId },
      data: updateData,
    });

    return NextResponse.json({
      id: page.id,
      pageNumber: page.pageNumber,
      duplicateOfId: page.duplicateOfId,
      duplicateConfidence: page.duplicateConfidence,
      isDuplicateReviewed: page.isDuplicateReviewed,
    });
  } catch (error) {
    console.error("Error updating page duplicate status:", error);
    return NextResponse.json(
      { error: "Failed to update page" },
      { status: 500 }
    );
  }
}
