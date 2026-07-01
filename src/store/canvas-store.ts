// src/store/canvas-store.ts
import { create } from "zustand";
import {
  applyNodeChanges,
  applyEdgeChanges,
  type Connection,
  type NodeChange,
  type EdgeChange,
} from "reactflow";
import { nanoid } from "nanoid";
import type {
  PyNode,
  PyEdge,
  ExecStatus,
  RequestInputsData,
  RequestField,
  RequestFieldType,
} from "@/types/workflow";
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
  hoveredEdgeId: string | null;
  duplicateNode: (nodeId: string, withEdges: boolean) => void;
  toggleNodeLock: (nodeId: string) => void;

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
  removeRequestField: (fieldId: string) => void;
  setNodeStatus: (nodeId: string, status: ExecStatus) => void;

  /**
   * "Add to Request" behavior: finds an existing, unconnected Request-Inputs
   * field of the right type (reusing it rather than spawning duplicates on
   * repeat clicks), or creates one if none exists, then wires an edge from
   * it into the given node/handle. Only supports "text" | "image" | "number"
   * since those are the field types Request-Inputs actually has.
   */
  addFieldAndConnect: (
    targetNodeId: string,
    targetHandle: string,
    dataType: Extract<HandleDataType, "text" | "image" | "number">,
    fieldLabel: string
  ) => void;

  setSelectedNodeIds: (ids: string[]) => void;
  clearSelection: () => void;
  setHoveredEdgeId: (id: string | null) => void;

  isHandleConnected: (nodeId: string, handleId: string) => boolean;

  pushHistory: () => void;
  undo: () => void;
  redo: () => void;

  setRunning: (running: boolean) => void;
  markSaved: () => void;
}

const LOCKED_NODE_IDS = new Set(["request-inputs", "response"]);
const REQUEST_NODE_ID = "request-inputs";

export const useCanvasStore = create<CanvasState>((set, get) => ({
  workflowId: null,
  workflowName: "Untitled Workflow",
  nodes: [],
  edges: [],
  selectedNodeIds: [],
  hoveredEdgeId: null,
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
      animated: false,
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

  duplicateNode: (nodeId, withEdges) => {
    const { nodes, edges } = get();
    if (LOCKED_NODE_IDS.has(nodeId)) return;
    const original = nodes.find((n) => n.id === nodeId);
    if (!original) return;

    const newId = `${original.type}_${nanoid(8)}`;
    const newNode: PyNode = {
      ...original,
      id: newId,
      position: { x: original.position.x + 40, y: original.position.y + 40 },
      selected: false,
      data: { ...original.data, status: "idle", error: undefined } as PyNode["data"],
    };

    const newEdges: PyEdge[] = withEdges
      ? edges
          .filter((e) => e.source === nodeId || e.target === nodeId)
          .map((e) => ({
            ...e,
            id: `edge_${nanoid(10)}`,
            source: e.source === nodeId ? newId : e.source,
            target: e.target === nodeId ? newId : e.target,
          }))
      : [];

    get().pushHistory();
    set((state) => ({
      nodes: [...state.nodes, newNode],
      edges: [...state.edges, ...newEdges],
      isDirty: true,
    }));
  },

  toggleNodeLock: (nodeId) => {
    set((state) => ({
      nodes: state.nodes.map((n) =>
        n.id === nodeId ? { ...n, draggable: n.draggable === false } : n
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

  removeRequestField: (fieldId) => {
    get().pushHistory();
    set((state) => ({
      nodes: state.nodes.map((n) =>
        n.id === REQUEST_NODE_ID
          ? {
              ...n,
              data: {
                ...(n.data as RequestInputsData),
                fields: (n.data as RequestInputsData).fields.filter(
                  (f) => f.id !== fieldId
                ),
              },
            }
          : n
      ),
      edges: state.edges.filter((e) => e.sourceHandle !== fieldId),
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

  addFieldAndConnect: (targetNodeId, targetHandle, dataType, fieldLabel) => {
    const { nodes, edges } = get();
    const requestNode = nodes.find((n) => n.id === REQUEST_NODE_ID);
    if (!requestNode || requestNode.type !== "request") return;

    const fieldType: RequestFieldType =
      dataType === "image"
        ? "image_field"
        : dataType === "number"
        ? "number_field"
        : "text_field";

    const requestData = requestNode.data as RequestInputsData;

    // Fields already wired to *something* are considered "spoken for" -
    // repeat clicks reuse the first matching field that isn't, rather than
    // spawning a new field every time.
    const connectedFieldIds = new Set(
      edges.filter((e) => e.source === REQUEST_NODE_ID).map((e) => e.sourceHandle)
    );
    let field: RequestField | undefined = requestData.fields.find(
      (f) => f.type === fieldType && !connectedFieldIds.has(f.id)
    );

    get().pushHistory();

    let nextNodes = nodes;
    if (!field) {
      const count = requestData.fields.filter((f) => f.type === fieldType).length;
      const baseName = fieldLabel || fieldType;
      const name = count === 0 ? baseName : `${baseName}_${count + 1}`;
      field = {
        id: `field_${nanoid(8)}`,
        name,
        type: fieldType,
        value: fieldType === "number_field" ? "0" : "",
      };
      const createdField = field;
      nextNodes = nodes.map((n) =>
        n.id === REQUEST_NODE_ID
          ? {
              ...n,
              data: {
                ...(n.data as RequestInputsData),
                fields: [...(n.data as RequestInputsData).fields, createdField],
              },
            }
          : n
      );
    }

    const allowsMulti = dataType === "image";
    const filteredEdges = allowsMulti
      ? edges
      : edges.filter(
          (e) => !(e.target === targetNodeId && e.targetHandle === targetHandle)
        );

    const newEdge: PyEdge = {
      id: `edge_${nanoid(10)}`,
      source: REQUEST_NODE_ID,
      target: targetNodeId,
      sourceHandle: field.id,
      targetHandle,
      animated: false,
      style: { stroke: colorForType(dataType), strokeWidth: 2 },
    };

    set({ nodes: nextNodes, edges: [...filteredEdges, newEdge], isDirty: true });
  },

  setSelectedNodeIds: (ids) => set({ selectedNodeIds: ids }),

  clearSelection: () =>
    set((state) => ({
      selectedNodeIds: [],
      nodes: state.nodes.map((n) => (n.selected ? { ...n, selected: false } : n)),
    })),

  setHoveredEdgeId: (id) => set({ hoveredEdgeId: id }),

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
    if (field?.type === "image_field") return "image";
    if (field?.type === "number_field") return "number";
    return "text";
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

export function isConnectionValid(
  nodes: PyNode[],
  aNodeId: string,
  aHandle: string | null,
  aType: "source" | "target",
  bNodeId: string,
  bHandle: string | null,
  bType: "source" | "target"
): boolean {
  if (!aNodeId || !bNodeId) return false;
  if (aNodeId === bNodeId) return false;
  if (aType === bType) return false;

  const sourceNodeId = aType === "source" ? aNodeId : bNodeId;
  const sourceHandle = aType === "source" ? aHandle : bHandle;
  const targetNodeId = aType === "target" ? aNodeId : bNodeId;
  const targetHandle = aType === "target" ? aHandle : bHandle;

  const sourceNode = nodes.find((n) => n.id === sourceNodeId);
  const targetNode = nodes.find((n) => n.id === targetNodeId);
  if (!sourceNode || !targetNode) return false;

  const sourceType = getOutputType(sourceNode, sourceHandle);
  const targetType = getInputType(targetNode, targetHandle);
  return isCompatible(sourceType, targetType);
}