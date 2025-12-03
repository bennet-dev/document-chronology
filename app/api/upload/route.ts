import { Storage } from "@google-cloud/storage";
import { NextRequest, NextResponse } from "next/server";

// Initialize Google Cloud Storage client
const storage = new Storage({
  projectId: process.env.GCS_PROJECT_ID,
  credentials: {
    client_email: process.env.GCS_CLIENT_EMAIL,
    private_key: process.env.GCS_PRIVATE_KEY?.replace(/\\n/g, "\n"),
  },
});

const bucketName = process.env.GCS_BUCKET_NAME || "";

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    // Generate a unique filename to prevent collisions
    const uniqueFilename = `${Date.now()}-${file.name}`;
    const bucket = storage.bucket(bucketName);
    const gcsFile = bucket.file(uniqueFilename);

    // Convert file to buffer
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Upload to Google Cloud Storage
    await gcsFile.save(buffer, {
      metadata: {
        contentType: file.type,
      },
    });

    return NextResponse.json({
      success: true,
      filename: uniqueFilename,
    });
  } catch (error) {
    console.error("Error uploading file:", error);
    return NextResponse.json(
      { error: "Failed to upload file" },
      { status: 500 }
    );
  }
}
