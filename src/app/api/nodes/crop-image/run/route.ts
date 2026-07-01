import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { cropImageTaskInputSchema } from "@/lib/schemas";

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const parsed = cropImageTaskInputSchema.safeParse(body);
  if (!parsed.success) {
    const message =
      parsed.error.issues.map((i) => i.message).join("; ") || "Invalid input";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  try {
    const { cropImageTask } = await import("@/trigger/crop-image");
    const { triggerAndWaitOutsideTask } = await import("@/lib/trigger-helpers");
    const result = await triggerAndWaitOutsideTask(cropImageTask, parsed.data);
    return NextResponse.json({ outputImageUrl: result.outputImageUrl });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Crop Image task failed" },
      { status: 500 }
    );
  }
}