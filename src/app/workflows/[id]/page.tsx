import { auth } from "@clerk/nextjs/server";
import { redirect, notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { WorkflowCanvas } from "@/components/canvas/workflow-canvas";
import type { WorkflowGraph } from "@/types/workflow";

export default async function WorkflowPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const { id } = await params;
  const workflow = await prisma.workflow.findUnique({ where: { id } });

  if (!workflow || workflow.userId !== userId) notFound();

  const graph = workflow.graph as unknown as WorkflowGraph;

  return (
    <main className="h-screen w-screen overflow-hidden">
      <WorkflowCanvas
        workflowId={workflow.id}
        initialName={workflow.name}
        initialNodes={graph.nodes}
        initialEdges={graph.edges}
      />
    </main>
  );
}
