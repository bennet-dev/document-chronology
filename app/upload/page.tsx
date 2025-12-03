"use client";

import { useState, useCallback } from "react";
import { useStore } from "@/lib/store";

interface UploadStatus {
  status: "idle" | "uploading" | "success" | "error";
  message: string;
  publicUrl?: string;
}

export default function UploadPage() {
  const addUploadedDoc = useStore((state) => state.addUploadedDoc);
  const uploadedDocs = useStore((state) => state.uploadedDocs);
  const selectedDoc = useStore((state) => state.selectedDoc);
  const ocrResults = useStore((state) => state.ocrResults);
  const setOcrResults = useStore((state) => state.setOcrResults);
  const setSelectedDoc = useStore((state) => state.setSelectedDoc);
  const [dragActive, setDragActive] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<UploadStatus>({
    status: "idle",
    message: "",
  });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [processing, setProcessing] = useState(false);

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
      // Upload file through our API (avoids CORS issues)
      const formData = new FormData();
      formData.append("file", selectedFile);

      const response = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error("Failed to upload file");
      }

      const { filename, publicUrl } = await response.json();

      addUploadedDoc(filename);

      setUploadStatus({
        status: "success",
        message: "File uploaded successfully!",
        publicUrl,
      });
      setSelectedFile(null);
    } catch (error) {
      setUploadStatus({
        status: "error",
        message: error instanceof Error ? error.message : "Upload failed",
      });
    }
  };

  return (
    <div className="min-h-screen bg-linear-to-br from-zinc-50 to-zinc-100 dark:from-zinc-900 dark:to-black p-8">
      <div className="max-w-2xl mx-auto">
        <div className="bg-white dark:bg-zinc-800 rounded-2xl shadow-xl p-8">
          <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-50 mb-2">
            Upload Document
          </h1>
          <p className="text-zinc-600 dark:text-zinc-400 mb-8">
            Upload your files securely to cloud storage
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
                    Drop your file here, or{" "}
                    <label
                      htmlFor="file-upload"
                      className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 cursor-pointer underline"
                    >
                      browse
                    </label>
                  </p>
                  <p className="text-sm text-zinc-500 dark:text-zinc-400">
                    Supports all file types
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
              {uploadStatus.publicUrl && (
                <a
                  href={uploadStatus.publicUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm underline mt-2 block hover:opacity-75"
                >
                  View uploaded file
                </a>
              )}
            </div>
          )}

          {/* Uploaded Documents Dropdown */}
          {uploadedDocs.length > 0 && (
            <div className="mt-8">
              <label
                htmlFor="doc-select"
                className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2"
              >
                Uploaded Documents
              </label>
              <select
                id="doc-select"
                value={selectedDoc || ""}
                onChange={(e) => setSelectedDoc(e.target.value || null)}
                className="w-full px-4 py-2 border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value={""}>Select a document</option>
                {uploadedDocs.map((doc) => (
                  <option key={doc} value={doc}>
                    {doc}
                  </option>
                ))}
              </select>
              {selectedDoc && (
                <button
                  onClick={async () => {
                    setProcessing(true);
                    setOcrResults(null);
                    try {
                      const response = await fetch("/api/process", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ filename: selectedDoc }),
                      });
                      if (!response.ok) throw new Error("Processing failed");
                      const data = await response.json();
                      console.log("OCR Results:", Object.keys(data));
                      setOcrResults(data);
                      console.log("PAGES: ", data.pages);
                    } catch (error) {
                      console.error("Error processing document:", error);
                      setOcrResults(null);
                    } finally {
                      setProcessing(false);
                    }
                  }}
                  disabled={processing}
                  className="w-full mt-4 bg-green-600 hover:bg-green-700 disabled:bg-zinc-400 text-white font-semibold py-3 px-6 rounded-lg transition-colors disabled:cursor-not-allowed"
                >
                  {processing ? "Processing..." : "Begin Processing"}
                </button>
              )}
              {processing && (
                <div className="mt-4 text-center text-sm text-zinc-600 dark:text-zinc-400">
                  This can take several minutes....
                </div>
              )}
            </div>
          )}

          {/* OCR Results */}
          {ocrResults && (
            <div className="mt-8 space-y-6">
              <div>
                <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50 mb-2">
                  Extracted Text
                </h3>
                <div className="max-h-96 overflow-y-auto border border-zinc-300 dark:border-zinc-600 rounded-lg p-4 bg-zinc-50 dark:bg-zinc-900">
                  <pre className="text-sm text-zinc-800 dark:text-zinc-200 whitespace-pre-wrap font-mono">
                    {ocrResults?.text}
                  </pre>
                </div>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50 mb-2">
                  Full OCR Response (JSON)
                </h3>
                <div className="max-h-96 overflow-y-auto border border-zinc-300 dark:border-zinc-600 rounded-lg p-4 bg-zinc-50 dark:bg-zinc-900">
                  <pre className="text-xs text-zinc-800 dark:text-zinc-200 whitespace-pre-wrap font-mono">
                    {JSON.stringify(ocrResults, null, 2)}
                  </pre>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Info Section */}
        <div className="mt-6 text-center text-sm text-zinc-600 dark:text-zinc-400">
          <p>Files are uploaded securely using pre-signed URLs</p>
        </div>
      </div>
    </div>
  );
}
