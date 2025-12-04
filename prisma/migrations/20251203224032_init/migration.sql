-- CreateTable
CREATE TABLE "Document" (
    "id" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "gcsPath" TEXT NOT NULL,
    "fileHash" TEXT,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),
    "totalPages" INTEGER,
    "pagesWithDates" INTEGER,

    CONSTRAINT "Document_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Page" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "pageNumber" INTEGER NOT NULL,
    "text" TEXT NOT NULL,
    "hasDate" BOOLEAN NOT NULL DEFAULT false,
    "llmAnalyzed" BOOLEAN NOT NULL DEFAULT false,
    "textHash" TEXT,
    "simHash" TEXT,
    "duplicateOfId" TEXT,
    "duplicateConfidence" DOUBLE PRECISION,
    "isDuplicateReviewed" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Page_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DateEvent" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "pageId" TEXT,
    "date" TEXT NOT NULL,
    "rawDateText" TEXT,
    "summary" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "source" TEXT NOT NULL,
    "llmModel" TEXT,
    "userEdited" BOOLEAN NOT NULL DEFAULT false,
    "userNotes" TEXT,
    "duplicateOfId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DateEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Document_gcsPath_key" ON "Document"("gcsPath");

-- CreateIndex
CREATE UNIQUE INDEX "Document_fileHash_key" ON "Document"("fileHash");

-- CreateIndex
CREATE INDEX "Page_documentId_idx" ON "Page"("documentId");

-- CreateIndex
CREATE INDEX "Page_textHash_idx" ON "Page"("textHash");

-- CreateIndex
CREATE INDEX "Page_simHash_idx" ON "Page"("simHash");

-- CreateIndex
CREATE UNIQUE INDEX "Page_documentId_pageNumber_key" ON "Page"("documentId", "pageNumber");

-- CreateIndex
CREATE INDEX "DateEvent_documentId_idx" ON "DateEvent"("documentId");

-- CreateIndex
CREATE INDEX "DateEvent_date_idx" ON "DateEvent"("date");

-- CreateIndex
CREATE INDEX "DateEvent_pageId_idx" ON "DateEvent"("pageId");

-- AddForeignKey
ALTER TABLE "Page" ADD CONSTRAINT "Page_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Page" ADD CONSTRAINT "Page_duplicateOfId_fkey" FOREIGN KEY ("duplicateOfId") REFERENCES "Page"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DateEvent" ADD CONSTRAINT "DateEvent_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DateEvent" ADD CONSTRAINT "DateEvent_pageId_fkey" FOREIGN KEY ("pageId") REFERENCES "Page"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DateEvent" ADD CONSTRAINT "DateEvent_duplicateOfId_fkey" FOREIGN KEY ("duplicateOfId") REFERENCES "DateEvent"("id") ON DELETE SET NULL ON UPDATE CASCADE;
