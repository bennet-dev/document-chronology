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

    // Generate signed URL for PDF viewing (1 hour expiry)
    const [url] = await storage.bucket(bucketName).file(filename).getSignedUrl({
      action: "read",
      expires: Date.now() + 60 * 60 * 1000,
    });

    return NextResponse.json({ url });
  } catch (error) {
    console.error("Error generating PDF URL:", error);
    return NextResponse.json(
      { error: "Failed to generate PDF URL" },
      { status: 500 }
    );
  }
}
