import { Storage } from "@google-cloud/storage";
import { NextRequest, NextResponse } from "next/server";

const storage = new Storage({
  projectId: process.env.GCS_PROJECT_ID,
  credentials: {
    client_email: process.env.GCS_CLIENT_EMAIL,
    private_key: process.env.GCS_PRIVATE_KEY?.replace(/\\n/g, "\n"),
  },
});

const bucketName = process.env.GCS_BUCKET_NAME!;

export async function GET(request: NextRequest) {
  try {
    const filename = request.nextUrl.searchParams.get("filename");

    if (!filename) {
      return NextResponse.json(
        { error: "Filename is required" },
        { status: 400 }
      );
    }

    const file = storage.bucket(bucketName).file(filename);

    // Check if file exists
    const [exists] = await file.exists();
    if (!exists) {
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }

    // Get file metadata for content type
    const [metadata] = await file.getMetadata();

    // Stream the file content
    const [buffer] = await file.download();

    // Convert Buffer to Uint8Array for NextResponse compatibility
    const uint8Array = new Uint8Array(buffer);

    return new NextResponse(uint8Array, {
      headers: {
        "Content-Type": metadata.contentType || "application/pdf",
        "Content-Length": buffer.length.toString(),
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch (error) {
    console.error("Error fetching PDF:", error);
    return NextResponse.json(
      { error: "Failed to fetch PDF" },
      { status: 500 }
    );
  }
}
