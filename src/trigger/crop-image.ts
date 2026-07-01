import { task, wait } from "@trigger.dev/sdk/v3";
import sharp from "sharp";
import { uploadBufferToTransloadit } from "@/lib/transloadit";

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
 *
 * IMPORTANT: this task runs on Trigger.dev's cloud infrastructure, which does
 * NOT share a filesystem with Vercel or your local dev machine. It can only
 * read input images via http(s) fetch, and must store its output via a real
 * remote store (Transloadit here) rather than writing to local disk - a
 * previous version of this task wrote to `public/uploads` locally, which
 * worked in local dev (same filesystem) but throws ENOENT / produces
 * unreachable files once deployed.
 */
export const cropImageTask = task({
  id: "crop-image",
  maxDuration: 120,
  run: async (payload: CropImagePayload): Promise<CropImageResult> => {
    const { inputImageUrl, x, y, width, height } = payload;

    const inputBuffer = await fetchImageBuffer(inputImageUrl);
    const image = sharp(inputBuffer);
    const metadata = await image.metadata();

    const imgWidth = metadata.width ?? 1000;
    const imgHeight = metadata.height ?? 1000;

    const left = Math.round((x / 100) * imgWidth);
    const top = Math.round((y / 100) * imgHeight);
    const cropWidth = Math.max(1, Math.round((width / 100) * imgWidth));
    const cropHeight = Math.max(1, Math.round((height / 100) * imgHeight));

    const safeWidth = Math.min(cropWidth, imgWidth - left);
    const safeHeight = Math.min(cropHeight, imgHeight - top);

    const croppedBuffer = await image
      .extract({ left, top, width: safeWidth, height: safeHeight })
      .png()
      .toBuffer();

    // --- MANDATORY 30+ second artificial delay (hard requirement, do not skip) ---
    await wait.for({ seconds: 31 });

    const filename = `crop-${Date.now()}.png`;
    const outputImageUrl = await uploadBufferToTransloadit(croppedBuffer, filename, "image/png");

    return { outputImageUrl };
  },
});

async function fetchImageBuffer(url: string): Promise<Buffer> {
  if (url.startsWith("/uploads/")) {
    throw new Error(
      `Cannot read local path "${url}" from inside a Trigger.dev task - Trigger.dev's cloud ` +
        `runners don't share a filesystem with Vercel or your local dev server. Make sure ` +
        `USE_LOCAL_UPLOAD_FALLBACK=false and real TRANSLOADIT_* credentials are set (in both ` +
        `Vercel AND the Trigger.dev dashboard's Environment Variables) so uploaded images get ` +
        `real http(s) URLs instead of local paths.`
    );
  }

  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch input image: ${res.status}`);
  const arrayBuffer = await res.arrayBuffer();
  return Buffer.from(arrayBuffer);
}