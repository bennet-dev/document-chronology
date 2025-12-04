import { ImageAnnotatorClient } from "@google-cloud/vision";
import { Storage } from "@google-cloud/storage";
import { NextRequest, NextResponse } from "next/server";
import { getDatesWithContext } from "@/lib/chronology";
import { prisma } from "@/lib/db";
import { computeTextHash, computeSimHash } from "@/lib/utils/textHash";
import type { PageResult, ExtractedDate } from "@/lib/types/chronology";

const visionClient = new ImageAnnotatorClient({
  projectId: process.env.GCS_PROJECT_ID,
  credentials: {
    client_email: process.env.GCS_CLIENT_EMAIL,
    private_key: process.env.GCS_PRIVATE_KEY?.replace(/\\n/g, "\n"),
  },
});

const storage = new Storage({
  projectId: process.env.GCS_PROJECT_ID,
  credentials: {
    client_email: process.env.GCS_CLIENT_EMAIL,
    private_key: process.env.GCS_PRIVATE_KEY?.replace(/\\n/g, "\n"),
  },
});

const bucketName = process.env.GCS_BUCKET_NAME!;
const outputPrefix = "vision-output";

export interface ProcessResponse {
  success: boolean;
  documentId: string;
  pages: PageResult[];
  pagesWithDates: number[];
  pdfUrl: string;
  totalPages: number;
  fromCache: boolean;
}

export async function POST(request: NextRequest) {
  console.log("[process] Starting process request");

  try {
    const { filename, documentId } = await request.json();
    console.log("[process] Request params:", { filename, documentId });

    if (!filename && !documentId) {
      return NextResponse.json(
        { error: "filename or documentId is required" },
        { status: 400 }
      );
    }

    // Find document record
    console.log("[process] Looking up document in database");
    let document;
    try {
      document = documentId
        ? await prisma.document.findUnique({
            where: { id: documentId },
            include: { pages: { orderBy: { pageNumber: "asc" } } },
          })
        : await prisma.document.findFirst({
            where: { filename },
            include: { pages: { orderBy: { pageNumber: "asc" } } },
          });
    } catch (dbError) {
      console.error("[process] Database error looking up document:", dbError);
      return NextResponse.json(
        { error: "Database error", details: String(dbError) },
        { status: 500 }
      );
    }

    if (!document) {
      console.error("[process] Document not found");
      return NextResponse.json(
        { error: "Document not found" },
        { status: 404 }
      );
    }

    console.log("[process] Document found:", document.id, "with", document.pages.length, "existing pages");

    const docFilename = document.filename;

    // Check if already processed (has pages)
    if (document.pages.length > 0) {
      console.log("[process] Returning cached results for", document.pages.length, "pages");
      // Return cached results
      const pages: PageResult[] = document.pages.map((p) => {
        const extractedDates = getDatesWithContext(p.text);
        return {
          pageNumber: p.pageNumber,
          text: p.text,
          extractedDates,
          dateOfService: null,
          dateSource: "none" as const,
        };
      });

      const pagesWithDates = pages
        .filter((p) => p.extractedDates.length > 0)
        .map((p) => p.pageNumber);

      return NextResponse.json({
        success: true,
        documentId: document.id,
        pages,
        pagesWithDates,
        pdfUrl: `/api/pdf?filename=${encodeURIComponent(docFilename)}`,
        totalPages: pages.length,
        fromCache: true,
      } as ProcessResponse);
    }

    // Run OCR
    console.log("[process] Starting OCR for document:", docFilename);
    const gcsInputUri = `gs://${bucketName}/${docFilename}`;
    const gcsOutputUri = `gs://${bucketName}/${outputPrefix}/`;

    // Clean up previous output
    await storage.bucket(bucketName).deleteFiles({ prefix: outputPrefix });

    const [operation] = await visionClient.asyncBatchAnnotateFiles({
      requests: [
        {
          inputConfig: {
            gcsSource: { uri: gcsInputUri },
            mimeType: "application/pdf",
          },
          features: [{ type: "DOCUMENT_TEXT_DETECTION" }],
          outputConfig: {
            gcsDestination: { uri: gcsOutputUri },
            batchSize: 100,
          },
        },
      ],
    });

    console.log("[process] Waiting for OCR operation to complete...");
    await operation.promise();
    console.log("[process] OCR operation complete");

    // Get OCR output files
    const [files] = await storage.bucket(bucketName).getFiles({
      prefix: outputPrefix,
    });

    const jsonFiles = files.filter((f) => f.name.endsWith(".json"));
    console.log("[process] Found", jsonFiles.length, "JSON output files");
    if (jsonFiles.length === 0) {
      console.error("[process] No OCR output found");
      return NextResponse.json(
        { error: "No OCR output found" },
        { status: 500 }
      );
    }

    // Parse OCR results and extract dates with context
    const pages: PageResult[] = [];
    const pagesWithDates: number[] = [];
    const pageDataForDb: {
      pageNumber: number;
      text: string;
      hasDate: boolean;
      textHash: string;
      simHash: string;
    }[] = [];

    // Sort JSON files to ensure consistent page ordering
    jsonFiles.sort((a, b) => a.name.localeCompare(b.name));

    let globalPageNumber = 0;
    for (const f of jsonFiles) {
      const [buf] = await f.download();
      const parsed = JSON.parse(buf.toString("utf8"));

      const responses = parsed.responses ?? [];
      responses.forEach((r: { fullTextAnnotation?: { text?: string } }) => {
        globalPageNumber++;
        const pageNumber = globalPageNumber;
        const text = r.fullTextAnnotation?.text ?? "";

        // Extract dates with context
        const extractedDates: ExtractedDate[] = getDatesWithContext(text);
        const hasDate = extractedDates.length > 0;

        if (hasDate) {
          pagesWithDates.push(pageNumber);
        }

        // Compute hashes for duplicate detection
        const textHash = computeTextHash(text);
        const simHash = computeSimHash(text);

        pages.push({
          pageNumber,
          text,
          extractedDates,
          dateOfService: null,
          dateSource: "none",
        });

        pageDataForDb.push({
          pageNumber,
          text,
          hasDate,
          textHash,
          simHash,
        });
      });
    }

    console.log("[process] Parsed", pageDataForDb.length, "pages,", pagesWithDates.length, "have dates");

    // Deduplicate pages by pageNumber (in case OCR returns duplicates)
    const uniquePages = new Map<number, typeof pageDataForDb[0]>();
    for (const p of pageDataForDb) {
      if (!uniquePages.has(p.pageNumber)) {
        uniquePages.set(p.pageNumber, p);
      }
    }
    const deduplicatedPages = Array.from(uniquePages.values());
    console.log("[process] After deduplication:", deduplicatedPages.length, "pages");

    // Clear existing data and save new pages in a transaction
    console.log("[process] Saving pages to database in transaction");
    try {
      await prisma.$transaction(async (tx) => {
        await tx.dateEvent.deleteMany({
          where: { documentId: document.id },
        });
        await tx.page.deleteMany({
          where: { documentId: document.id },
        });

        // Save pages to database
        await tx.page.createMany({
          data: deduplicatedPages.map((p) => ({
            documentId: document.id,
            pageNumber: p.pageNumber,
            text: p.text,
            hasDate: p.hasDate,
            textHash: p.textHash,
            simHash: p.simHash,
          })),
        });
      });
      console.log("[process] Transaction complete");
    } catch (txError) {
      console.error("[process] Transaction failed:", txError);
      return NextResponse.json(
        { error: "Failed to save pages to database", details: String(txError) },
        { status: 500 }
      );
    }

    // Update document with page counts
    await prisma.document.update({
      where: { id: document.id },
      data: {
        totalPages: deduplicatedPages.length,
        pagesWithDates: pagesWithDates.length,
        processedAt: new Date(),
      },
    });

    const response: ProcessResponse = {
      success: true,
      documentId: document.id,
      pages,
      pagesWithDates,
      pdfUrl: `/api/pdf?filename=${encodeURIComponent(docFilename)}`,
      totalPages: pages.length,
      fromCache: false,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("[process] Unexpected error:", error);
    console.error("[process] Error stack:", error instanceof Error ? error.stack : "No stack");
    return NextResponse.json(
      { error: "Failed to process document", details: String(error) },
      { status: 500 }
    );
  }
}
