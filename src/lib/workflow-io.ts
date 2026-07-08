import type { PyEdge, PyNode, WorkflowGraph } from "@/types/workflow";

export interface WorkflowExportFile {
  formatVersion: 1;
  exportedAt: string;
  name: string;
  graph: WorkflowGraph;
}

export function buildWorkflowExport(
  name: string,
  nodes: PyNode[],
  edges: PyEdge[]
): WorkflowExportFile {
  return {
    formatVersion: 1,
    exportedAt: new Date().toISOString(),
    name,
    graph: { nodes, edges },
  };
}

export function downloadWorkflowJson(name: string, nodes: PyNode[], edges: PyEdge[]) {
  const payload = buildWorkflowExport(name, nodes, edges);
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const safeName = name.trim().replace(/[^a-z0-9-_]+/gi, "_").toLowerCase() || "workflow";
  a.href = url;
  a.download = `${safeName}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export class WorkflowImportError extends Error {}

export function parseWorkflowImport(raw: string): {
  name: string | null;
  nodes: PyNode[];
  edges: PyEdge[];
} {
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    throw new WorkflowImportError("That file isn't valid JSON.");
  }

  if (!json || typeof json !== "object") {
    throw new WorkflowImportError("Unrecognized workflow file format.");
  }

  const obj = json as Record<string, unknown>;
  // Accepts either our own export shape ({ name, graph: { nodes, edges } })
  // or a bare { nodes, edges } graph.
  const graph = (obj.graph && typeof obj.graph === "object" ? obj.graph : obj) as Record<
    string,
    unknown
  >;

  const nodes = graph.nodes;
  const edges = graph.edges;

  if (!Array.isArray(nodes) || !Array.isArray(edges)) {
    throw new WorkflowImportError(
      "This file doesn't look like a Py workflow export (missing nodes/edges)."
    );
  }

  for (const n of nodes) {
    if (!n || typeof n !== "object" || typeof (n as Record<string, unknown>).id !== "string") {
      throw new WorkflowImportError("A node in this file is missing a valid id.");
    }
  }

  return {
    name: typeof obj.name === "string" ? obj.name : null,
    nodes: nodes as PyNode[],
    edges: edges as PyEdge[],
  };
}

/**
 * Defensive fallback: the rest of the app assumes request-inputs/response
 * always exist. Re-adds them if an imported file somehow dropped one.
 */
export function ensureLockedNodesPresent(nodes: PyNode[]): PyNode[] {
  const hasRequest = nodes.some((n) => n.id === "request-inputs");
  const hasResponse = nodes.some((n) => n.id === "response");
  if (hasRequest && hasResponse) return nodes;

  const extra: PyNode[] = [];
  if (!hasRequest) {
    extra.push({
      id: "request-inputs",
      type: "request",
      position: { x: 0, y: 0 },
      data: { label: "Request-Inputs", locked: true, fields: [] },
    });
  }
  if (!hasResponse) {
    extra.push({
      id: "response",
      type: "response",
      position: { x: 900, y: 0 },
      data: { label: "Response", locked: true, slots: [] },
    });
  }
  return [...nodes, ...extra];
}