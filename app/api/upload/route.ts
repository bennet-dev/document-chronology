import { Storage } from "@google-cloud/storage";
import { NextRequest, NextResponse } from "next/server";
import { createHash } from "crypto";
import { prisma } from "@/lib/db";

// Initialize Google Cloud Storage client
const storage = new Storage({
  projectId: process.env.GCS_PROJECT_ID,
  credentials: {
    client_email: process.env.GCS_CLIENT_EMAIL,
    private_key: process.env.GCS_PRIVATE_KEY?.replace(/\\n/g, "\n"),
  },
});

const bucketName = process.env.GCS_BUCKET_NAME || "";

export interface UploadResponse {
  success: boolean;
  filename: string;
  documentId: string;
  alreadyExists: boolean;
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    // Convert file to buffer
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Compute file hash for deduplication
    const fileHash = createHash("sha256").update(buffer).digest("hex");

    // Check if document with same hash already exists
    const existingDoc = await prisma.document.findUnique({
      where: { fileHash },
    });

    if (existingDoc) {
      return NextResponse.json({
        success: true,
        filename: existingDoc.filename,
        documentId: existingDoc.id,
        alreadyExists: true,
      } as UploadResponse);
    }

    // Generate a unique filename to prevent collisions
    const uniqueFilename = `${Date.now()}-${file.name}`;
    const bucket = storage.bucket(bucketName);
    const gcsFile = bucket.file(uniqueFilename);

    // Upload to Google Cloud Storage
    await gcsFile.save(buffer, {
      metadata: {
        contentType: file.type,
      },
    });

    // Create document record in database
    const document = await prisma.document.create({
      data: {
        filename: uniqueFilename,
        gcsPath: uniqueFilename,
        fileHash,
      },
    });

    return NextResponse.json({
      success: true,
      filename: uniqueFilename,
      documentId: document.id,
      alreadyExists: false,
    } as UploadResponse);
  } catch (error) {
    console.error("Error uploading file:", error);
    return NextResponse.json(
      { error: "Failed to upload file" },
      { status: 500 }
    );
  }
}
