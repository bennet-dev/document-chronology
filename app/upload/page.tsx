"use client";

import { useState, useCallback } from "react";
import { useStore } from "@/lib/store";
import { useRouter } from "next/navigation";
import { ProcessingProgress } from "../timeline/components/ProcessingProgress";
import type { ProcessResponse } from "../api/process/route";
import type { UploadResponse } from "../api/upload/route";

interface UploadStatus {
  status: "idle" | "uploading" | "success" | "error";
  message: string;
}

export default function UploadPage() {
  const router = useRouter();
  const addUploadedDoc = useStore((state) => state.addUploadedDoc);
  const uploadedDocs = useStore((state) => state.uploadedDocs);
  const selectedDoc = useStore((state) => state.selectedDoc);
  const setSelectedDoc = useStore((state) => state.setSelectedDoc);
  const setCurrentDocumentId = useStore((state) => state.setCurrentDocumentId);
  const setPdfUrl = useStore((state) => state.setPdfUrl);
  const processingStatus = useStore((state) => state.processingStatus);
  const setProcessingStatus = useStore((state) => state.setProcessingStatus);
  const setProcessingPhase = useStore((state) => state.setProcessingPhase);
  const resetProcessing = useStore((state) => state.resetProcessing);

  const [dragActive, setDragActive] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<UploadStatus>({
    status: "idle",
    message: "",
  });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const isProcessing = !["idle", "done", "error"].includes(
    processingStatus.phase
  );

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setSelectedFile(e.dataTransfer.files[0]);
      setUploadStatus({ status: "idle", message: "" });
    }
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
      setUploadStatus({ status: "idle", message: "" });
    }
  };

  const uploadFile = async () => {
    if (!selectedFile) return;

    setUploadStatus({ status: "uploading", message: "Uploading file..." });

    try {
      const formData = new FormData();
      formData.append("file", selectedFile);

      const response = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error("Failed to upload file");
      }

      const data: UploadResponse = await response.json();

      addUploadedDoc(data.filename);
      setSelectedDoc(data.filename);

      if (data.alreadyExists) {
        setUploadStatus({
          status: "success",
          message: "Document already uploaded. Ready to process.",
        });
      } else {
        setUploadStatus({
          status: "success",
          message: "File uploaded successfully!",
        });
      }
      setSelectedFile(null);
    } catch (error) {
      setUploadStatus({
        status: "error",
        message: error instanceof Error ? error.message : "Upload failed",
      });
    }
  };

  const processDocument = async () => {
    if (!selectedDoc) return;

    resetProcessing();

    try {
      // Phase 1: OCR + Date Extraction
      setProcessingPhase("ocr", 10);
      setProcessingStatus({ message: "Running OCR on PDF pages..." });

      const processResponse = await fetch("/api/process", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filename: selectedDoc }),
      });

      if (!processResponse.ok) throw new Error("OCR processing failed");

      const processData: ProcessResponse = await processResponse.json();
      const documentId = processData.documentId;

      // Store document ID in state
      setCurrentDocumentId(documentId);
      setPdfUrl(processData.pdfUrl);

      if (processData.fromCache) {
        setProcessingPhase("extracting", 40);
        setProcessingStatus({
          message: `Loaded ${processData.totalPages} pages from cache`,
        });
      } else {
        setProcessingPhase("extracting", 40);
        setProcessingStatus({
          message: `Processed ${processData.totalPages} pages, ${processData.pagesWithDates.length} have dates`,
        });
      }

      // Phase 2: LLM Classification for ALL pages with dates
      if (processData.pagesWithDates.length > 0) {
        setProcessingPhase("classifying", 50);
        setProcessingStatus({
          message: `Analyzing ${processData.pagesWithDates.length} pages with AI...`,
        });

        const pagesToClassify = processData.pages
          .filter((p) => processData.pagesWithDates.includes(p.pageNumber))
          .map((p) => ({
            pageNumber: p.pageNumber,
            text: p.text,
            extractedDates: p.extractedDates,
          }));

        const classifyResponse = await fetch("/api/classify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ documentId, pages: pagesToClassify }),
        });

        if (classifyResponse.ok) {
          const classifyData = await classifyResponse.json();
          setProcessingStatus({
            message: `Created ${classifyData.eventsCreated} events from AI analysis`,
          });
        }
      }

      setProcessingPhase("done", 100);
      setProcessingStatus({ message: "Processing complete!" });

      // Navigate to timeline after short delay
      setTimeout(() => {
        router.push("/timeline");
      }, 1000);
    } catch (error) {
      console.error("Error processing document:", error);
      setProcessingPhase("error", 0);
      setProcessingStatus({
        error:
          error instanceof Error ? error.message : "Processing failed",
      });
    }
  };

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-900 p-8">
      <div className="max-w-2xl mx-auto">
        <div className="bg-white dark:bg-zinc-800 rounded-2xl shadow-xl p-8">
          <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-50 mb-2">
            Upload Medical Records
          </h1>
          <p className="text-zinc-600 dark:text-zinc-400 mb-8">
            Upload a PDF to extract dates and build a chronological timeline
          </p>

          {/* Drop Zone */}
          <div
            className={`relative border-2 border-dashed rounded-xl p-12 text-center transition-all ${
              dragActive
                ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
                : "border-zinc-300 dark:border-zinc-600 hover:border-zinc-400 dark:hover:border-zinc-500"
            }`}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
          >
            <input
              type="file"
              id="file-upload"
              className="hidden"
              accept=".pdf"
              onChange={handleFileSelect}
            />

            <div className="space-y-4">
              <div className="flex justify-center">
                <svg
                  className="w-16 h-16 text-zinc-400 dark:text-zinc-500"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                  />
                </svg>
              </div>

              {selectedFile ? (
                <div className="space-y-2">
                  <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                    Selected: {selectedFile.name}
                  </p>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">
                    {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                  </p>
                </div>
              ) : (
                <div>
                  <p className="text-lg font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                    Drop your PDF here, or{" "}
                    <label
                      htmlFor="file-upload"
                      className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 cursor-pointer underline"
                    >
                      browse
                    </label>
                  </p>
                  <p className="text-sm text-zinc-500 dark:text-zinc-400">
                    PDF files only
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Upload Button */}
          {selectedFile && (
            <button
              onClick={uploadFile}
              disabled={uploadStatus.status === "uploading"}
              className="w-full mt-6 bg-blue-600 hover:bg-blue-700 disabled:bg-zinc-400 text-white font-semibold py-3 px-6 rounded-lg transition-colors disabled:cursor-not-allowed"
            >
              {uploadStatus.status === "uploading"
                ? "Uploading..."
                : "Upload File"}
            </button>
          )}

          {/* Status Messages */}
          {uploadStatus.message && (
            <div
              className={`mt-6 p-4 rounded-lg ${
                uploadStatus.status === "success"
                  ? "bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-200"
                  : uploadStatus.status === "error"
                  ? "bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-200"
                  : "bg-blue-50 dark:bg-blue-900/20 text-blue-800 dark:text-blue-200"
              }`}
            >
              <p className="font-medium">{uploadStatus.message}</p>
            </div>
          )}

          {/* Document Selection & Processing */}
          {uploadedDocs.length > 0 && (
            <div className="mt-8">
              <label
                htmlFor="doc-select"
                className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2"
              >
                Select Document to Process
              </label>
              <select
                id="doc-select"
                value={selectedDoc || ""}
                onChange={(e) => setSelectedDoc(e.target.value || null)}
                disabled={isProcessing}
                className="w-full px-4 py-2 border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
              >
                <option value="">Select a document</option>
                {uploadedDocs.map((doc) => (
                  <option key={doc} value={doc}>
                    {doc}
                  </option>
                ))}
              </select>

              {selectedDoc && !isProcessing && (
                <button
                  onClick={processDocument}
                  className="w-full mt-4 bg-green-600 hover:bg-green-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors"
                >
                  Build Timeline
                </button>
              )}
            </div>
          )}

          {/* Processing Progress */}
          {(isProcessing || processingStatus.phase === "error") && (
            <div className="mt-8">
              <ProcessingProgress status={processingStatus} />
            </div>
          )}
        </div>

        {/* Info Section */}
        <div className="mt-6 text-center text-sm text-zinc-600 dark:text-zinc-400">
          <p>
            Medical records are processed using OCR and AI to extract dates of
            service
          </p>
        </div>
      </div>
    </div>
  );
}
