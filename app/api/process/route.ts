import { ImageAnnotatorClient } from "@google-cloud/vision";
import { Storage } from "@google-cloud/storage";
import { NextRequest, NextResponse } from "next/server";
import { hasDate, getDates } from "@/lib/chronology";

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
const outputPrefix = "vision-output"; // folder in same bucket (or another)

export type PageDateConnection = {
  pageNumber: number;
  date: string;
};

export async function POST(request: NextRequest) {
  try {
    const { filename } = await request.json();
    if (!filename) {
      return NextResponse.json(
        { error: "Filename is required" },
        { status: 400 }
      );
    }

    const gcsInputUri = `gs://${bucketName}/${filename}`;
    const gcsOutputUri = `gs://${bucketName}/${outputPrefix}/`;

    //NOTE: Probably not great for production use.
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
            batchSize: 100, // pages per output JSON shard
          },
        },
      ],
    });

    // Wait for OCR job to finish
    await operation.promise();

    // Vision writes one or more JSON files to gcsOutputUri.
    // We list them and load the newest shard(s).
    const [files] = await storage.bucket(bucketName).getFiles({
      prefix: outputPrefix,
    });

    // Filter to Vision JSON outputs
    const jsonFiles = files.filter((f) => f.name.endsWith(".json"));
    if (jsonFiles.length === 0) {
      return NextResponse.json(
        { error: "No OCR output found" },
        { status: 500 }
      );
    }

    // For MVP, read all shards and concatenate fullTextAnnotation.text
    let fullText = "";
    const pages: { pageNumber: number; text: string }[] = [];

    for (const f of jsonFiles) {
      const [buf] = await f.download();
      const parsed = JSON.parse(buf.toString("utf8"));

      const responses = parsed.responses ?? [];
      responses.forEach((r: any, index: number) => {
        if (r.fullTextAnnotation?.text)
          console.log("FULL TEXT FOUND", r.fullTextAnnotation);
        fullText += r.fullTextAnnotation.text + "\n";
        if (r.fullTextAnnotation?.pages)
          pages.push({
            pageNumber: index + 1,
            text: r.fullTextAnnotation.text,
          });
      });
    }

    const connections: PageDateConnection[] = [];
    pages.forEach((p) => {
      const datesOnPage = getDates(p.text);
      datesOnPage.forEach((date) => {
        connections.push({ pageNumber: p.pageNumber, date });
      });
    });

    return NextResponse.json({
      success: true,
      text: fullText,
      pages,
      connections,
    });
  } catch (error) {
    console.error("Error processing document:", error);
    return NextResponse.json(
      { error: "Failed to process document" },
      { status: 500 }
    );
  }
}
