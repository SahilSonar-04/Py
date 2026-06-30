import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { sampleWorkflowGraph } from "@/lib/sample-workflow";

export async function POST() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const workflow = await prisma.workflow.create({
    data: {
      userId,
      name: "Sample: Headphones Marketing Post",
      graph: sampleWorkflowGraph() as object,
    },
  });

  return NextResponse.json({ workflow }, { status: 201 });
}
