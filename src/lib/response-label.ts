import type { PyNode } from "@/types/workflow";

export function labelForResponseSource(
  sourceNode: PyNode | undefined,
  sourceHandle: string | null | undefined
): string {
  if (!sourceNode) return "input";

  if (sourceNode.type === "request") {
    const data = sourceNode.data as { fields?: { id: string; name: string }[] };
    const field = data.fields?.find((f) => f.id === sourceHandle);
    return field?.name ?? "input";
  }

  const rawLabel = (sourceNode.data as { label?: string })?.label ?? sourceNode.type ?? "node";
  const normalized = rawLabel
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

  return normalized || "node";
}