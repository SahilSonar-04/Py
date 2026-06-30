import { task, wait } from "@trigger.dev/sdk/v3";
import sharp from "sharp";
import { writeFile } from "fs/promises";
import path from "path";
import { nanoid } from "nanoid";

export interface CropImagePayload {
  inputImageUrl: string;
  x: number; // 0-100, percentage
  y: number; // 0-100
  width: number; // 0-100
  height: number; // 0-100
}

export interface CropImageResult {
  outputImageUrl: string;
}

/**
 * MANDATORY per spec: this task must await at least 30 seconds before returning,
 * to simulate a realistic FFmpeg-via-Trigger.dev processing delay.
 *
 * Implementation note: actual cropping is done with `sharp` (fast, deterministic,
 * percentage-based crop box) rather than shelling out to ffmpeg directly, since the
 * cropping operation itself is instant - the 30s wait is the explicit hard
 * requirement being satisfied here, not a simulation of real processing time.
 */
export const cropImageTask = task({
  id: "crop-image",
  maxDuration: 120,
  run: async (payload: CropImagePayload): Promise<CropImageResult> => {
    const { inputImageUrl, x, y, width, height } = payload;

    // Resolve the input image (supports local /uploads/* paths and remote URLs)
    const inputBuffer = await fetchImageBuffer(inputImageUrl);
    const image = sharp(inputBuffer);
    const metadata = await image.metadata();

    const imgWidth = metadata.width ?? 1000;
    const imgHeight = metadata.height ?? 1000;

    const left = Math.round((x / 100) * imgWidth);
    const top = Math.round((y / 100) * imgHeight);
    const cropWidth = Math.max(1, Math.round((width / 100) * imgWidth));
    const cropHeight = Math.max(1, Math.round((height / 100) * imgHeight));

    // Clamp so the crop box never exceeds image bounds
    const safeWidth = Math.min(cropWidth, imgWidth - left);
    const safeHeight = Math.min(cropHeight, imgHeight - top);

    const croppedBuffer = await image
      .extract({ left, top, width: safeWidth, height: safeHeight })
      .png()
      .toBuffer();

    // --- MANDATORY 30+ second artificial delay (hard requirement, do not skip) ---
    await wait.for({ seconds: 31 });

    const filename = `${nanoid(12)}-crop.png`;
    const uploadDir = path.join(process.cwd(), "public", "uploads");
    const filePath = path.join(uploadDir, filename);
    await writeFile(filePath, croppedBuffer);

    return { outputImageUrl: `/uploads/${filename}` };
  },
});

async function fetchImageBuffer(url: string): Promise<Buffer> {
  if (url.startsWith("/uploads/")) {
    const { readFile } = await import("fs/promises");
    const filePath = path.join(process.cwd(), "public", url);
    return readFile(filePath);
  }
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch input image: ${res.status}`);
  const arrayBuffer = await res.arrayBuffer();
  return Buffer.from(arrayBuffer);
}
