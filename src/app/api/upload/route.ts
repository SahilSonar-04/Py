import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { mkdir, readdir, writeFile } from "fs/promises";
import path from "path";
import crypto from "crypto";
import { nanoid } from "nanoid";

const ALLOWED_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp", "image/gif"];
const IMAGE_EXT = new Set([".png", ".jpg", ".jpeg", ".webp", ".gif"]);

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
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

    const useLocalFallback = process.env.USE_LOCAL_UPLOAD_FALLBACK === "true";
    return useLocalFallback ? await handleLocalUpload(file) : await handleTransloaditUpload(file);
  } catch (err) {
    console.error("[/api/upload] failed:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Upload failed unexpectedly" },
      { status: 500 }
    );
  }
}

async function handleLocalUpload(file: File) {
  const bytes = await file.arrayBuffer();
  const buffer = Buffer.from(bytes);
  const ext = file.name.split(".").pop() || "png";
  const filename = `${nanoid(12)}.${ext}`;
  const uploadDir = path.join(process.cwd(), "public", "uploads");
  await mkdir(uploadDir, { recursive: true });
  const filePath = path.join(uploadDir, filename);
  await writeFile(filePath, buffer);
  return NextResponse.json({ url: `/uploads/${filename}` });
}

/**
 * Uses Transloadit with zero storage account: no export step, no
 * TRANSLOADIT_TEMPLATE_ID, no S3/R2/B2 credentials. We just take the
 * temporary ssl_url that Transloadit returns for the raw uploaded file
 * (assembly.uploads[]).
 *
 * Trade-off: these URLs expire ~24h after upload (Transloadit's own
 * documented limit for un-exported files). 
 */
async function handleTransloaditUpload(file: File) {
  const authKey = process.env.TRANSLOADIT_AUTH_KEY;
  const authSecret = process.env.TRANSLOADIT_AUTH_SECRET;

  if (!authKey || !authSecret || authKey.includes("PLACEHOLDER")) {
    return NextResponse.json(
      { error: "TRANSLOADIT_AUTH_KEY / TRANSLOADIT_AUTH_SECRET are not set" },
      { status: 501 }
    );
  }

  // Transloadit expects "YYYY/MM/DD HH:MM:SS+00:00"
  const expires = new Date(Date.now() + 5 * 60 * 1000)
    .toISOString()
    .replace(/\.\d+Z$/, "+00:00")
    .replace(/-/g, "/")
    .replace("T", " ");

  const params = JSON.stringify({
    auth: { key: authKey, expires },
    steps: {
      ":original": { robot: "/upload/handle" },
    },
  });

  const signature =
    "sha384:" +
    crypto.createHmac("sha384", authSecret).update(Buffer.from(params, "utf-8")).digest("hex");

  const uploadForm = new FormData();
  uploadForm.append("params", params);
  uploadForm.append("signature", signature);
  uploadForm.append("file", file, file.name);

  const createRes = await fetch("https://api2.transloadit.com/assemblies", {
    method: "POST",
    body: uploadForm,
  });
  let assembly = await createRes.json();

  if (assembly.error) {
    return NextResponse.json({ error: assembly.message ?? assembly.error }, { status: 500 });
  }

  const statusUrl = assembly.assembly_ssl_url as string;
  for (let i = 0; i < 15 && (!assembly.uploads || assembly.uploads.length === 0); i++) {
    if (assembly.ok === "ASSEMBLY_ERROR") break;
    await new Promise((r) => setTimeout(r, 500));
    const poll = await fetch(statusUrl);
    assembly = await poll.json();
  }

  const uploaded = assembly.uploads?.[0];
  if (!uploaded?.ssl_url) {
    return NextResponse.json(
      { error: assembly.message ?? "Upload finished but Transloadit returned no file URL" },
      { status: 500 }
    );
  }

  return NextResponse.json({ url: uploaded.ssl_url });
}

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const useLocalFallback = process.env.USE_LOCAL_UPLOAD_FALLBACK === "true";
  if (!useLocalFallback) {
    return NextResponse.json({ urls: [] });
  }

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