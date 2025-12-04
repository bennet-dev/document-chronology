import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { simHashSimilarity } from "@/lib/utils/textHash";

export interface DuplicateGroup {
  pages: {
    id: string;
    pageNumber: number;
    similarity: number;
  }[];
  primaryPageId: string;
  primaryPageNumber: number;
}

export interface DuplicatesResponse {
  documentId: string;
  exactDuplicates: DuplicateGroup[];
  nearDuplicates: DuplicateGroup[];
}

// GET /api/duplicates?documentId=xxx - Get duplicate page groups for a document
export async function GET(request: NextRequest) {
  try {
    const documentId = request.nextUrl.searchParams.get("documentId");

    if (!documentId) {
      return NextResponse.json(
        { error: "documentId is required" },
        { status: 400 }
      );
    }

    const pages = await prisma.page.findMany({
      where: { documentId },
      orderBy: { pageNumber: "asc" },
      select: {
        id: true,
        pageNumber: true,
        textHash: true,
        simHash: true,
        duplicateOfId: true,
        isDuplicateReviewed: true,
      },
    });

    // Group exact duplicates by textHash
    const exactHashGroups = new Map<string, typeof pages>();
    for (const page of pages) {
      if (!page.textHash) continue;
      const group = exactHashGroups.get(page.textHash) || [];
      group.push(page);
      exactHashGroups.set(page.textHash, group);
    }

    const exactDuplicates: DuplicateGroup[] = [];
    for (const [, group] of exactHashGroups) {
      if (group.length > 1) {
        // First page is primary
        const primary = group[0];
        exactDuplicates.push({
          primaryPageId: primary.id,
          primaryPageNumber: primary.pageNumber,
          pages: group.map((p) => ({
            id: p.id,
            pageNumber: p.pageNumber,
            similarity: 1.0, // Exact match
          })),
        });
      }
    }

    // Find near-duplicates using simHash
    // Only check pages not already in exact duplicate groups
    const pagesInExactGroups = new Set<string>();
    for (const group of exactDuplicates) {
      for (const page of group.pages) {
        pagesInExactGroups.add(page.id);
      }
    }

    const remainingPages = pages.filter((p) => !pagesInExactGroups.has(p.id));
    const nearDuplicateGroups: Map<string, typeof pages> = new Map();
    const processedPages = new Set<string>();

    for (let i = 0; i < remainingPages.length; i++) {
      const pageA = remainingPages[i];
      if (processedPages.has(pageA.id) || !pageA.simHash) continue;

      const group = [pageA];
      processedPages.add(pageA.id);

      for (let j = i + 1; j < remainingPages.length; j++) {
        const pageB = remainingPages[j];
        if (processedPages.has(pageB.id) || !pageB.simHash) continue;

        const similarity = simHashSimilarity(pageA.simHash, pageB.simHash);
        if (similarity >= 0.9) {
          // 90% similarity threshold for near-duplicates
          group.push(pageB);
          processedPages.add(pageB.id);
        }
      }

      if (group.length > 1) {
        nearDuplicateGroups.set(pageA.id, group);
      }
    }

    const nearDuplicates: DuplicateGroup[] = [];
    for (const [primaryId, group] of nearDuplicateGroups) {
      const primary = group[0];
      nearDuplicates.push({
        primaryPageId: primaryId,
        primaryPageNumber: primary.pageNumber,
        pages: group.map((p) => ({
          id: p.id,
          pageNumber: p.pageNumber,
          similarity:
            p.id === primaryId
              ? 1.0
              : simHashSimilarity(primary.simHash!, p.simHash!),
        })),
      });
    }

    const response: DuplicatesResponse = {
      documentId,
      exactDuplicates,
      nearDuplicates,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("Error fetching duplicates:", error);
    return NextResponse.json(
      { error: "Failed to fetch duplicates" },
      { status: 500 }
    );
  }
}
