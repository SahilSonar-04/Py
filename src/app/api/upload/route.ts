import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { readdir } from "fs/promises";
import { writeFile } from "fs/promises";
import path from "path";
import { nanoid } from "nanoid";

const ALLOWED_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp", "image/gif"];
const IMAGE_EXT = new Set([".png", ".jpg", ".jpeg", ".webp", ".gif"]);

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const useLocalFallback = process.env.USE_LOCAL_UPLOAD_FALLBACK !== "false";

  if (!useLocalFallback) {
    // --- Transloadit path (wire in real keys to activate) ---
    // Left as a clearly-marked extension point: build an assembly using
    // TRANSLOADIT_AUTH_KEY / TRANSLOADIT_AUTH_SECRET / TRANSLOADIT_TEMPLATE_ID
    // and return the resulting CDN url. Falling back to local storage for now
    // since Transloadit credentials are placeholders.
    return NextResponse.json(
      { error: "Transloadit not configured yet - set USE_LOCAL_UPLOAD_FALLBACK=true" },
      { status: 501 }
    );
  }

  const formData = await req.formData();
  const file = formData.get("file");

  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json(
      { error: `Unsupported file type: ${file.type}. Allowed: jpg, jpeg, png, webp, gif` },
      { status: 400 }
    );
  }

  const bytes = await file.arrayBuffer();
  const buffer = Buffer.from(bytes);

  const ext = file.name.split(".").pop() || "png";
  const filename = `${nanoid(12)}.${ext}`;
  const uploadDir = path.join(process.cwd(), "public", "uploads");
  const filePath = path.join(uploadDir, filename);

  await writeFile(filePath, buffer);

  const url = `/uploads/${filename}`;
  return NextResponse.json({ url });
}

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const uploadDir = path.join(process.cwd(), "public", "uploads");
  try {
    const files = await readdir(uploadDir);
    const urls = files
      .filter((f) => IMAGE_EXT.has(path.extname(f).toLowerCase()))
      .sort()
      .reverse()
      .map((f) => `/uploads/${f}`);
    return NextResponse.json({ urls });
  } catch {
    return NextResponse.json({ urls: [] });
  }
}