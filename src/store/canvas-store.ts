import { create } from "zustand";
import {
  applyNodeChanges,
  applyEdgeChanges,
  type Connection,
  type NodeChange,
  type EdgeChange,
} from "reactflow";
import { nanoid } from "nanoid";
import type { PyNode, PyEdge, ExecStatus } from "@/types/workflow";
import {
  NODE_INPUT_TYPES,
  NODE_OUTPUT_TYPES,
  type HandleDataType,
} from "@/types/workflow";

interface HistoryEntry {
  nodes: PyNode[];
  edges: PyEdge[];
}

interface CanvasState {
  workflowId: string | null;
  workflowName: string;
  nodes: PyNode[];
  edges: PyEdge[];
  selectedNodeIds: string[];

  past: HistoryEntry[];
  future: HistoryEntry[];

  isDirty: boolean;
  isRunning: boolean;

  setWorkflow: (
    workflowId: string,
    name: string,
    nodes: PyNode[],
    edges: PyEdge[]
  ) => void;
  setNodes: (nodes: PyNode[]) => void;
  setEdges: (edges: PyEdge[]) => void;
  onNodesChange: (changes: NodeChange[]) => void;
  onEdgesChange: (changes: EdgeChange[]) => void;
  onConnect: (connection: Connection) => void;

  addNode: (node: PyNode) => void;
  updateNodeData: (
    nodeId: string,
    partialData: Record<string, unknown>
  ) => void;
  removeNode: (nodeId: string) => void;
  setNodeStatus: (nodeId: string, status: ExecStatus) => void;

  setSelectedNodeIds: (ids: string[]) => void;

  // Added
  isHandleConnected: (nodeId: string, handleId: string) => boolean;

  pushHistory: () => void;
  undo: () => void;
  redo: () => void;

  setRunning: (running: boolean) => void;
  markSaved: () => void;
}

const LOCKED_NODE_IDS = new Set(["request-inputs", "response"]);

export const useCanvasStore = create<CanvasState>((set, get) => ({
  workflowId: null,
  workflowName: "Untitled Workflow",
  nodes: [],
  edges: [],
  selectedNodeIds: [],
  past: [],
  future: [],
  isDirty: false,
  isRunning: false,

  setWorkflow: (workflowId, name, nodes, edges) =>
    set({
      workflowId,
      workflowName: name,
      nodes,
      edges,
      past: [],
      future: [],
      isDirty: false,
    }),

  setNodes: (nodes) => set({ nodes, isDirty: true }),
  setEdges: (edges) => set({ edges, isDirty: true }),

  onNodesChange: (changes) => {
    const filtered = changes.filter((c) => {
      if (c.type === "remove" && LOCKED_NODE_IDS.has(c.id)) return false;
      return true;
    });
    set((state) => ({
      nodes: applyNodeChanges(filtered, state.nodes) as PyNode[],
      isDirty: true,
    }));
  },

  onEdgesChange: (changes) => {
    set((state) => ({
      edges: applyEdgeChanges(changes, state.edges),
      isDirty: true,
    }));
  },

  onConnect: (connection) => {
    const { nodes, edges } = get();
    if (!connection.source || !connection.target) return;
    if (connection.source === connection.target) return;

    const sourceNode = nodes.find((n) => n.id === connection.source);
    const targetNode = nodes.find((n) => n.id === connection.target);
    if (!sourceNode || !targetNode) return;

    const sourceType = getOutputType(sourceNode, connection.sourceHandle);
    const targetType = getInputType(targetNode, connection.targetHandle);
    if (!isCompatible(sourceType, targetType)) return;

    // Only "image" / "any" targets accept multiple incoming edges (vision fan-in).
    // Every other handle type replaces any existing edge into that target handle.
    const allowsMulti = targetType === "image" || targetType === "any";
    const filteredEdges = allowsMulti
      ? edges
      : edges.filter(
          (e) =>
            !(
              e.target === connection.target &&
              e.targetHandle === connection.targetHandle
            )
        );

    if (
      wouldCreateCycle(filteredEdges, connection.source, connection.target)
    )
      return;

    const newEdge: PyEdge = {
      id: `edge_${nanoid(10)}`,
      source: connection.source,
      target: connection.target,
      sourceHandle: connection.sourceHandle,
      targetHandle: connection.targetHandle,
      animated: true,
      style: { stroke: colorForType(sourceType), strokeWidth: 2 },
    };

    get().pushHistory();
    set({ edges: [...filteredEdges, newEdge], isDirty: true });
  },

  addNode: (node) => {
    get().pushHistory();
    set((state) => ({
      nodes: [...state.nodes, node],
      isDirty: true,
    }));
  },

  updateNodeData: (nodeId, partialData) => {
    set((state) => ({
      nodes: state.nodes.map((n) =>
        n.id === nodeId
          ? { ...n, data: { ...n.data, ...partialData } }
          : n
      ),
      isDirty: true,
    }));
  },

  removeNode: (nodeId) => {
    if (LOCKED_NODE_IDS.has(nodeId)) return;
    get().pushHistory();
    set((state) => ({
      nodes: state.nodes.filter((n) => n.id !== nodeId),
      edges: state.edges.filter(
        (e) => e.source !== nodeId && e.target !== nodeId
      ),
      isDirty: true,
    }));
  },

  setNodeStatus: (nodeId, status) => {
    set((state) => ({
      nodes: state.nodes.map((n) =>
        n.id === nodeId
          ? { ...n, data: { ...n.data, status } }
          : n
      ),
    }));
  },

  setSelectedNodeIds: (ids) => set({ selectedNodeIds: ids }),

  // Added
  isHandleConnected: (nodeId, handleId) =>
    get().edges.some(
      (e) => e.target === nodeId && e.targetHandle === handleId
    ),

  pushHistory: () => {
    const { nodes, edges, past } = get();
    set({
      past: [...past.slice(-49), { nodes, edges }],
      future: [],
    });
  },

  undo: () => {
    const { past, nodes, edges, future } = get();
    if (past.length === 0) return;
    const previous = past[past.length - 1];
    set({
      nodes: previous.nodes,
      edges: previous.edges,
      past: past.slice(0, -1),
      future: [{ nodes, edges }, ...future],
      isDirty: true,
    });
  },

  redo: () => {
    const { future, nodes, edges, past } = get();
    if (future.length === 0) return;
    const next = future[0];
    set({
      nodes: next.nodes,
      edges: next.edges,
      future: future.slice(1),
      past: [...past, { nodes, edges }],
      isDirty: true,
    });
  },

  setRunning: (running) => set({ isRunning: running }),
  markSaved: () => set({ isDirty: false }),
}));

function getOutputType(
  node: PyNode,
  handle: string | null | undefined
): HandleDataType {
  if (!handle) return "any";
  if (node.type === "request") {
    const data = node.data as { fields: { id: string; type: string }[] };
    const field = data.fields.find((f) => f.id === handle);
    return field?.type === "image_field" ? "image" : "text";
  }
  return NODE_OUTPUT_TYPES[`${node.type}:${handle}`] ?? "any";
}

function getInputType(
  node: PyNode,
  handle: string | null | undefined
): HandleDataType {
  if (!handle) return "any";
  return NODE_INPUT_TYPES[`${node.type}:${handle}`] ?? "any";
}

function isCompatible(
  source: HandleDataType,
  target: HandleDataType
): boolean {
  if (source === "any" || target === "any") return true;
  return source === target;
}

function colorForType(type: HandleDataType): string {
  const map: Record<HandleDataType, string> = {
    text: "#f59e0b",
    image: "#3b82f6",
    video: "#8b5cf6",
    audio: "#06b6d4",
    file: "#64748b",
    number: "#ec4899",
    boolean: "#6366f1",
    any: "#22c55e",
  };
  return map[type];
}

function wouldCreateCycle(
  edges: PyEdge[],
  source: string,
  target: string
): boolean {
  const adjacency = new Map<string, string[]>();
  for (const e of edges) {
    const list = adjacency.get(e.source) ?? [];
    list.push(e.target);
    adjacency.set(e.source, list);
  }
  const visited = new Set<string>();
  const stack = [target];
  while (stack.length) {
    const current = stack.pop()!;
    if (current === source) return true;
    if (visited.has(current)) continue;
    visited.add(current);
    stack.push(...(adjacency.get(current) ?? []));
  }
  return false;
}