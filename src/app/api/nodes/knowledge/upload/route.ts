import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";

const TEXT_EXTENSIONS = new Set([".txt", ".md", ".csv", ".json", ".xml", ".html", ".log"]);
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const formData = await req.formData();
    const file = formData.get("file");

    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: "File too large. Maximum size is 10MB." },
        { status: 400 }
      );
    }

    const ext = "." + (file.name.split(".").pop()?.toLowerCase() ?? "");

    // PDF — server-side parsing
    if (ext === ".pdf") {
      const buffer = Buffer.from(await file.arrayBuffer());
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const pdfModule = await import("pdf-parse") as any;
      const pdfParse = (pdfModule.default ?? pdfModule) as (buf: Buffer) => Promise<{ text: string; numpages: number }>;
      const pdf = await pdfParse(buffer);

      if (!pdf.text || pdf.text.trim().length === 0) {
        return NextResponse.json(
          { error: "Could not extract text from this PDF. It may be image-based (scanned)." },
          { status: 422 }
        );
      }

      return NextResponse.json({
        text: pdf.text,
        fileName: file.name,
        charCount: pdf.text.length,
        pageCount: pdf.numpages,
      });
    }

    // Word Documents (.docx, .doc) — server-side parsing via mammoth
    if (ext === ".docx" || ext === ".doc") {
      const buffer = Buffer.from(await file.arrayBuffer());
      const mammoth = await import("mammoth");
      const result = await mammoth.extractRawText({ buffer });
      const text = result.value;

      if (!text || text.trim().length === 0) {
        return NextResponse.json(
          { error: "Could not extract text from Word document." },
          { status: 422 }
        );
      }

      return NextResponse.json({
        text,
        fileName: file.name,
        charCount: text.length,
      });
    }

    // Plain text formats — read directly
    if (TEXT_EXTENSIONS.has(ext)) {
      const text = await file.text();

      if (!text || text.trim().length === 0) {
        return NextResponse.json({ error: "File is empty" }, { status: 422 });
      }

      return NextResponse.json({
        text,
        fileName: file.name,
        charCount: text.length,
      });
    }

    return NextResponse.json(
      {
        error: `Unsupported file type: ${ext}. Supported: .pdf, .doc, .docx, .txt, .md, .csv, .json, .xml, .html, .log`,
      },
      { status: 400 }
    );
  } catch (err) {
    console.error("[/api/nodes/knowledge/upload] failed:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Document processing failed" },
      { status: 500 }
    );
  }
}
