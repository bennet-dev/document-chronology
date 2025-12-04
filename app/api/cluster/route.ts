import { NextRequest, NextResponse } from "next/server";
import type {
  PageResult,
  PageCluster,
  ChronologyResult,
} from "@/lib/types/chronology";

export interface ClusterRequest {
  pages: PageResult[];
}

export interface ClusterResponse {
  success: boolean;
  result: ChronologyResult;
}

/**
 * Applies forward inheritance: pages without a date of service
 * inherit from the most recent page that has one.
 */
function applyInheritance(pages: PageResult[]): PageResult[] {
  const result: PageResult[] = [];
  let lastDatedPage: PageResult | null = null;

  for (const page of pages) {
    if (page.dateOfService && page.dateSource !== "none") {
      // This page has its own date
      lastDatedPage = page;
      result.push({ ...page });
    } else if (lastDatedPage) {
      // Inherit from previous dated page
      result.push({
        ...page,
        dateOfService: lastDatedPage.dateOfService,
        dateSource: "inherited",
        inheritedFrom: lastDatedPage.pageNumber,
      });
    } else {
      // No date to inherit yet
      result.push({ ...page });
    }
  }

  return result;
}

/**
 * Groups pages into clusters by date of service.
 */
function buildClusters(pages: PageResult[]): PageCluster[] {
  const clusterMap = new Map<
    string,
    { pages: number[]; primaryPage: number; documentType?: string }
  >();

  for (const page of pages) {
    if (!page.dateOfService) continue;

    const existing = clusterMap.get(page.dateOfService);
    if (existing) {
      existing.pages.push(page.pageNumber);
      // Keep document type from primary page
    } else {
      clusterMap.set(page.dateOfService, {
        pages: [page.pageNumber],
        primaryPage: page.pageNumber,
        documentType: page.documentType,
      });
    }
  }

  // Convert to array and sort by date
  const clusters: PageCluster[] = [];
  for (const [dateOfService, data] of clusterMap) {
    clusters.push({
      id: `cluster-${dateOfService}-${data.primaryPage}`,
      dateOfService,
      pages: data.pages,
      primaryPage: data.primaryPage,
      documentType: data.documentType,
    });
  }

  // Sort clusters chronologically
  clusters.sort(
    (a, b) =>
      new Date(a.dateOfService).getTime() - new Date(b.dateOfService).getTime()
  );

  return clusters;
}

export async function POST(request: NextRequest) {
  try {
    const { pages } = (await request.json()) as ClusterRequest;

    if (!pages || pages.length === 0) {
      return NextResponse.json(
        { error: "No pages provided" },
        { status: 400 }
      );
    }

    // Sort pages by page number first
    const sortedPages = [...pages].sort(
      (a, b) => a.pageNumber - b.pageNumber
    );

    // Apply inheritance
    const pagesWithInheritance = applyInheritance(sortedPages);

    // Build clusters
    const clusters = buildClusters(pagesWithInheritance);

    // Find undated pages (still no date after inheritance)
    const undatedPages = pagesWithInheritance
      .filter((p) => !p.dateOfService)
      .map((p) => p.pageNumber);

    // Calculate stats
    const pagesWithDates = pages.filter(
      (p) => p.extractedDates.length > 0
    ).length;
    const pagesWithDOS = pagesWithInheritance.filter(
      (p) => p.dateOfService && p.dateSource !== "inherited"
    ).length;
    const pagesInherited = pagesWithInheritance.filter(
      (p) => p.dateSource === "inherited"
    ).length;
    const llmClassified = pages.filter(
      (p) => p.dateSource === "llm"
    ).length;

    const result: ChronologyResult = {
      pages: pagesWithInheritance,
      clusters,
      undatedPages,
      stats: {
        totalPages: pages.length,
        pagesWithDates,
        pagesWithDOS,
        pagesInherited,
        llmClassified,
      },
    };

    const response: ClusterResponse = {
      success: true,
      result,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("Error building clusters:", error);
    return NextResponse.json(
      { error: "Failed to build clusters" },
      { status: 500 }
    );
  }
}
