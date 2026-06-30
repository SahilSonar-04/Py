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
  RequestField,
  RequestInputsData,
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
  setNodeStatus: (nodeId: string, status: ExecStatus) => void;

  setSelectedNodeIds: (ids: string[]) => void;
  setHoveredEdgeId: (id: string | null) => void;

  isHandleConnected: (nodeId: string, handleId: string) => boolean;

  /**
   * "Add to Request" — creates (or reuses) a field on the Request-Inputs
   * node and wires it straight into the given target handle. No-ops if the
   * target handle is already connected to something.
   */
  addFieldToRequest: (
    targetNodeId: string,
    targetHandleId: string,
    dataType: HandleDataType,
    label: string,
    defaultValue?: string
  ) => void;

  /**
   * Deletes a field from Request-Inputs and cascades: every edge sourced
   * from that field is removed in the same update so nothing dangles.
   */
  removeRequestField: (fieldId: string) => void;

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
    if (LOCKED_NODE_IDS.has(nodeId)) return; // don't duplicate the singleton nodes
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
  setHoveredEdgeId: (id) => set({ hoveredEdgeId: id }),

  isHandleConnected: (nodeId, handleId) =>
    get().edges.some(
      (e) => e.target === nodeId && e.targetHandle === handleId
    ),

  addFieldToRequest: (targetNodeId, targetHandleId, dataType, label, defaultValue = "") => {
    const { nodes, edges } = get();

    // Already wired to something -> nothing to do.
    const alreadyConnected = edges.some(
      (e) => e.target === targetNodeId && e.targetHandle === targetHandleId
    );
    if (alreadyConnected) return;

    const requestNode = nodes.find((n) => n.id === "request-inputs");
    if (!requestNode) return;
    const requestData = requestNode.data as RequestInputsData;

    const fieldType: RequestFieldType =
      dataType === "image" ? "image_field" : dataType === "number" ? "number_field" : "text_field";

    // "if in request that field is not there, it will be created" -
    // dedupe by name so re-using a label doesn't collide with an existing one.
    const existingNames = new Set(requestData.fields.map((f) => f.name));
    let name = label;
    let i = 1;
    while (existingNames.has(name)) {
      i += 1;
      name = `${label}_${i}`;
    }

    const fieldId = `field_${nanoid(8)}`;
    const newField: RequestField = { id: fieldId, name, type: fieldType, value: defaultValue };

    const allowsMulti = dataType === "image" || dataType === "any";
    const filteredEdges = allowsMulti
      ? edges
      : edges.filter((e) => !(e.target === targetNodeId && e.targetHandle === targetHandleId));

    const newEdge: PyEdge = {
      id: `edge_${nanoid(10)}`,
      source: "request-inputs",
      target: targetNodeId,
      sourceHandle: fieldId,
      targetHandle: targetHandleId,
      animated: false,
      style: { stroke: colorForType(dataType), strokeWidth: 2 },
    };

    get().pushHistory();
    set({
      nodes: nodes.map((n) =>
        n.id === "request-inputs"
          ? { ...n, data: { ...requestData, fields: [...requestData.fields, newField] } }
          : n
      ),
      edges: [...filteredEdges, newEdge],
      isDirty: true,
    });
  },

  removeRequestField: (fieldId) => {
    get().pushHistory();
    set((state) => ({
      nodes: state.nodes.map((n) =>
        n.id === "request-inputs"
          ? {
              ...n,
              data: {
                ...n.data,
                fields: (n.data as RequestInputsData).fields.filter((f) => f.id !== fieldId),
              },
            }
          : n
      ),
      // Cascade: strip every edge that originated from this field so
      // nothing is left dangling once the field itself is gone.
      edges: state.edges.filter(
        (e) => !(e.source === "request-inputs" && e.sourceHandle === fieldId)
      ),
      isDirty: true,
    }));
  },

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

/**
 * Standalone validity check usable outside onConnect (e.g. live drag-feedback,
 * isValidConnection prop) — given two endpoints with explicit handle "roles"
 * (source/target), resolves which is the real output and which the real
 * input and checks type compatibility + same-node rejection.
 */
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
  if (aType === bType) return false; // can't link two sources or two targets

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